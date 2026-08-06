-- Web Push: avisar de un entreno que se quedó abierto, con la app cerrada.
--
-- ── Por qué hace falta un servidor para esto ──────────────────────────────
-- El aviso que ya existía se apoyaba en un temporizador dentro de la página.
-- Eso funciona mientras la pestaña siga viva, y en una PWA de iOS no sigue
-- viva: al pasar a segundo plano el temporizador se congela y no vuelve hasta
-- que se abre la app — justo el caso que el aviso quería cubrir.
--
-- Web Push va por otro camino: el navegador mantiene su propio canal abierto
-- con su servicio de push (Apple, Google, Mozilla) y despierta al service
-- worker cuando llega algo. Pero ese «algo» lo tiene que enviar alguien desde
-- fuera, así que hace falta saber en el servidor cuándo un entreno lleva rato
-- desatendido. De ahí `workouts.last_seen_at`: la app lo va sellando mientras
-- está delante, y el reloj de ese sello es lo único que distingue «sigue
-- entrenando» de «se dejó esto abierto».
--
-- ── Reparto ──────────────────────────────────────────────────────────────
-- · push_subscriptions — a qué buzón escribir. Una fila por dispositivo.
-- · app_secrets        — la clave VAPID privada. Ni anon ni authenticated la
--                        alcanzan: sin políticas y sin permisos, solo el rol de
--                        servicio (que se salta RLS) la lee.
-- · pending_workout_reminders() — a quién toca avisar. SECURITY DEFINER y
--                        concedida solo al rol de servicio, porque cruza
--                        entrenos de todo el mundo.
-- · cron              — cada 5 minutos despierta a la edge function.

-- ── Extensiones ──────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ── Secretos del servidor ────────────────────────────────────────────────
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- Sin políticas: RLS sin políticas es denegar a todo el mundo. Y además sin
-- permisos de tabla, para que ni siquiera exista para PostgREST.
revoke all on public.app_secrets from anon, authenticated;

comment on table public.app_secrets is
  'Secretos que solo lee el rol de servicio (claves VAPID). RLS sin políticas + sin grants = nadie más.';

-- ── Suscripciones de push ────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  failed_at   timestamptz,
  fail_reason text
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "Cada quien gestiona sus suscripciones" on public.push_subscriptions;
create policy "Cada quien gestiona sus suscripciones" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Un conector no registra dispositivos: el permiso de notificación lo concede
-- una persona en su navegador, no un asistente por API. Mismas políticas que el
-- resto de tablas no escribibles por agentes (ver agent_audit.sql).
drop policy if exists "Sin escritura desde agentes ins" on public.push_subscriptions;
drop policy if exists "Sin escritura desde agentes upd" on public.push_subscriptions;
drop policy if exists "Sin escritura desde agentes del" on public.push_subscriptions;
create policy "Sin escritura desde agentes ins" on public.push_subscriptions
  as restrictive for insert with check (public.current_actor() = 'app');
create policy "Sin escritura desde agentes upd" on public.push_subscriptions
  as restrictive for update using (public.current_actor() = 'app')
  with check (public.current_actor() = 'app');
create policy "Sin escritura desde agentes del" on public.push_subscriptions
  as restrictive for delete using (public.current_actor() = 'app');

-- ── Estado del entreno ───────────────────────────────────────────────────
alter table public.workouts
  add column if not exists last_seen_at     timestamptz,
  add column if not exists reminder_sent_at timestamptz;

comment on column public.workouts.last_seen_at is
  'Última vez que la app estuvo delante con este entreno abierto. Lo sella el cliente.';
comment on column public.workouts.reminder_sent_at is
  'Cuándo se envió el último aviso de entreno abierto. Evita repetirlo hasta que se vuelva a ver la app.';

create index if not exists workouts_open_idle_idx
  on public.workouts (last_seen_at)
  where ended_at is null;

-- ── A quién toca avisar ──────────────────────────────────────────────────
-- Un entreno vivo, con sello, con más de 20 minutos sin que nadie lo mire, y
-- del que no se haya avisado ya desde ese mismo sello. Esa última condición es
-- la que evita el goteo: si se avisó y la persona no ha vuelto, `last_seen_at`
-- no se mueve, así que no vuelve a entrar.
create or replace function public.pending_workout_reminders(p_idle_minutes int default 20)
returns table (workout_id uuid, user_id uuid, workout_name text, idle_minutes int)
language sql
security definer
set search_path = public
as $$
  select w.id, w.user_id, w.name,
         (extract(epoch from (now() - w.last_seen_at)) / 60)::int
  from public.workouts w
  where w.ended_at is null
    and w.last_seen_at is not null
    and w.last_seen_at < now() - make_interval(mins => p_idle_minutes)
    and (w.reminder_sent_at is null or w.reminder_sent_at <= w.last_seen_at)
  order by w.last_seen_at asc
  limit 200;
$$;

revoke all on function public.pending_workout_reminders(int) from public, anon, authenticated;
grant execute on function public.pending_workout_reminders(int) to service_role;

create or replace function public.mark_workout_reminded(p_workout_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.workouts set reminder_sent_at = now() where id = p_workout_id;
$$;

revoke all on function public.mark_workout_reminded(uuid) from public, anon, authenticated;
grant execute on function public.mark_workout_reminded(uuid) to service_role;
