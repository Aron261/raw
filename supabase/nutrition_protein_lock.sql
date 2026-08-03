-- ── Proteína fijada a mano ───────────────────────────────────────────────
--
-- El motor deriva la proteína de la masa magra (2,0-2,5 g/kg según la fase).
-- Es un buen punto de partida y para mucha gente es la respuesta. Pero hay
-- quien tiene una cifra decidida —por su entrenador, por experiencia propia, o
-- sencillamente porque es la que le funciona— y esa cifra no es negociable.
--
-- Hasta ahora la recomendación se la pisaba: pulsar «Usar esto» rellenaba el
-- editor con la proteína calculada, y había que acordarse de corregirla a mano
-- cada vez. Un botón que deshace tu decisión cada vez que lo tocas es un botón
-- que dejas de tocar.
--
-- Con protein_locked = true, la recomendación toma la proteína que ya tienes
-- guardada y reparte lo demás alrededor: la grasa mantiene su regla y los
-- carbos absorben la diferencia. Las calorías no cambian.
--
-- ── Por qué un booleano y no una columna con el número ───────────────────
-- El número YA existe: es nutrition_targets.protein_g. Guardarlo por segunda
-- vez crearía dos fuentes de verdad que se pueden separar, y entonces habría
-- que decidir cuál gana. Esto solo dice «no lo recalcules», que es exactamente
-- lo que significa.
--
-- ── Qué NO se hizo, a propósito ──────────────────────────────────────────
-- · El candado NO afecta a los siete repartos manuales (Equilibrado, Keto…).
--   Elegir «Keto» es pedir explícitamente ese reparto; que el candado lo
--   ignorara en silencio sería peor que no tenerlo. Solo protege del cálculo
--   automático, que es de donde venía el problema.
-- · No hay candado equivalente para grasa ni carbos. Nadie lo ha pedido, y
--   fijar dos de tres macros deja el tercero sin grados de libertad: las
--   calorías dejarían de cuadrar y habría que decidir qué cede. Cuando haga
--   falta, será su propia decisión.
--
-- ── Guardia de agentes ───────────────────────────────────────────────────
-- No se crea ninguna tabla, así que NO hay que reejecutar agent_audit.sql.
-- nutrition_targets sigue sin ser escribible por agentes: el candado se pone
-- desde la app, como el resto de los objetivos.
--
-- Idempotente: se puede volver a ejecutar sin efecto.

alter table nutrition_targets
  add column if not exists protein_locked boolean not null default false;

comment on column nutrition_targets.protein_locked is
  'Si es true, la recomendación respeta protein_g en vez de calcularla desde la masa magra, y los carbos absorben la diferencia. El número vive en protein_g: aquí solo se dice que no se recalcule.';

-- ── Rollback ─────────────────────────────────────────────────────────────
-- alter table nutrition_targets drop column if exists protein_locked;
