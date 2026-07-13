-- =============================================================================
-- CHAT 1-a-1 ENTRENADOR ↔ CLIENTE
-- =============================================================================
-- El par (trainer_id, client_id) define la conversación. sender_id es quién
-- envió cada mensaje (uno de los dos participantes). Entrega en vivo con
-- Supabase Realtime. Correr DESPUÉS de trainers.sql y beta_gate.sql.

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references auth.users(id) on delete cascade not null,
  sender_id   uuid references auth.users(id) on delete cascade not null,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz default now(),
  read_at     timestamptz
);

create index if not exists idx_messages_conversation on messages (trainer_id, client_id, created_at);

alter table messages enable row level security;

-- Leer: cualquiera de los dos participantes
create policy "Participants read messages"
  on messages for select
  using (auth.uid() = trainer_id or auth.uid() = client_id);

-- Enviar: solo como uno mismo, siendo participante, y con vínculo ACTIVO
create policy "Participant sends as self"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and (auth.uid() = trainer_id or auth.uid() = client_id)
    and exists (
      select 1 from trainer_clients tc
      where tc.trainer_id = messages.trainer_id
        and tc.client_id  = messages.client_id
        and tc.status     = 'active'
    )
  );

-- Actualizar (marcar leído): solo el receptor (no el emisor), y a nivel de
-- privilegios solo la columna read_at es actualizable — el body de un mensaje
-- nunca se puede editar vía API.
drop policy if exists "Participants update messages" on messages;
create policy "Recipient marks messages read"
  on messages for update
  using ((auth.uid() = trainer_id or auth.uid() = client_id) and sender_id <> auth.uid())
  with check ((auth.uid() = trainer_id or auth.uid() = client_id) and sender_id <> auth.uid());

revoke update on table messages from anon, authenticated;
grant update (read_at) on table messages to authenticated;

-- Candado beta consistente con el resto
create policy "Beta gate" on messages as restrictive for all using (public.is_beta_approved());

-- Habilitar Realtime para entrega en vivo
alter publication supabase_realtime add table messages;
