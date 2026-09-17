-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 14 — El aviso de sesión va a TUS AMIGOS, de toda sesión, una vez
--
-- Decisión de producto (17 sep 2026, del usuario), en dos partes:
--   1. *"No quiero que sea solo cuando la sesión es fuerte, quiero que sea cuando un amigo ha hecho
--      una sesión."* Con la regla anterior (solo la última sesión de la semana, y solo si era `fuerte`
--      para quien la hizo), en diez días de beta hubo 25 sesiones de un amigo y UN aviso.
--   2. *"A la liga no, a tus amigos solo: puedes estar en una liga con 200 personas y que eso se
--      convierta en un caos, y además se duplicaría amigos y ligas."* Hasta hoy el aviso de sesión
--      era un aviso DE LIGA: uno por cada liga del autor, a todos sus miembros. Una liga de zona
--      tiene cientos; y alguien que compartiera dos ligas contigo recibía dos avisos de lo mismo.
--
-- Modelo nuevo: un aviso de clase 'sesion' por sesión, sin liga (`liga is null`) y sin destinatario
-- único: `destinatarios_de` lo reparte entre los AMIGOS del autor (`amistades` aceptadas) que tengan
-- los avisos activos. Una sesión, un aviso, un push por amigo. Las ligas dejan de intervenir.
--
-- Lo que se queda de la migración 12, porque es lo que hace tolerable avisar de todo:
--   · solo la clase 'sesion' desde el cliente;
--   · deduplicación por huella cualificada con el autor (repetir la sincronización no reavisa);
--   · cupo de 30 avisos cada 24 h por persona (el de 10 por liga deja de tener sentido). El cliente
--     además solo avisa de sesiones terminadas en las últimas 24 h (`src/motor/avisos.ts`).
--
-- ⚠️ COMPATIBILIDAD con el cliente viejo (build 10 sin la OTA): sigue llamando a `anotar_aviso` con
-- una liga y una huella `liga|sesion`, una vez por liga, solo para la última sesión fuerte. La
-- función ahora IGNORA la liga y normaliza la huella al último tramo (la sesión), así que sus tres
-- llamadas para una misma sesión chocan en la misma huella y sale UN aviso a los amigos. La firma no
-- cambia. Los avisos antiguos por liga ya enviados siguen resolviéndose como antes en
-- `destinatarios_de` (rama 1, `liga is not null`).
--
-- ✅ APLICADA a producción el 17 sep 2026 (13:00 Madrid), en transacción, con respaldo JSON previo en
-- supabase/.temp/respaldo-20260917-1144-antes-mig14/ (300 filas) y checklist pasado en transacciones
-- con rollback: sesión normal sin liga inserta con huella normalizada y 1 destinatario (el único
-- amigo); repetir en formato viejo no duplica; tono raro, liderato, sin sesión y liga ajena fallan
-- cerrados; 300 filas después; hay_demo() = 0. Publicada la OTA b0d213fb con el cliente nuevo.
--
-- No destructiva: una restricción relajada y dos funciones reemplazadas. Idempotente.
-- Aplicar con respaldo previo (supabase/.temp/respaldo.ps1) y:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-14-avisos-toda-sesion.sql
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. La restricción de coherencia admite la sesión SIN liga ─────────────────
-- Antes: 'sesion' exigía liga. Ahora la sesión lleva puntos y tono, y la liga es opcional (null en
-- las nuevas, la liga en las antiguas ya enviadas). El liderato sigue siendo de liga.
alter table avisos drop constraint if exists avisos_destino_check;
alter table avisos add constraint avisos_destino_check check (
  (clase = 'liderato' and liga is not null and puntos is not null and tono is not null)
  or (clase = 'sesion' and puntos is not null and tono is not null)
  or (clase in ('amistad','amistad_aceptada','reaccion','comentario') and destinatario is not null)
);

-- ── 2. `anotar_aviso`: una sesión, un aviso, sin liga ─────────────────────────
create or replace function anotar_aviso(
  p_liga uuid,
  p_clase text,
  p_puntos int,
  p_tono text,
  p_huella text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_sesion text;
  v_huella text;
  v_en_total int;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if p_clase is distinct from 'sesion' then
    raise exception 'clase no valida';
  end if;
  if p_huella is null or char_length(p_huella) not between 1 and 120 then
    raise exception 'huella no valida';
  end if;
  -- El tono ya no decide si se avisa (migración 14), pero tiene que ser uno de los tres: lo usa el
  -- texto del aviso. Antes aquí había un `return` para todo lo que no fuera 'fuerte'.
  if p_tono is null or p_tono not in ('suave', 'normal', 'fuerte') then
    raise exception 'tono no valido';
  end if;
  -- La liga ya no interviene. El cliente viejo la manda: si la manda, que sea una suya (mismo
  -- candado de siempre contra llamadas fabricadas); el nuevo manda null.
  if p_liga is not null and not es_miembro(p_liga, v_yo) then
    raise exception 'no estas en esa liga';
  end if;

  -- La huella se normaliza a la SESIÓN: el cliente nuevo manda `sesion`, el viejo `liga|sesion`.
  -- Así las llamadas del viejo para la misma sesión desde varias ligas chocan en un solo aviso.
  v_sesion := split_part(p_huella, '|', array_length(string_to_array(p_huella, '|'), 1));
  v_huella := v_yo::text || '|' || v_sesion;

  -- Repetir la misma sesión es la sincronización repitiéndose: no cuenta ni inserta. Se miran
  -- también las huellas antiguas por liga (`yo|liga|sesion`) para no reavisar una sesión que ya
  -- avisó por el camino viejo justo antes de actualizar la app.
  if exists (
    select 1 from avisos
     where autor = v_yo
       and (huella = v_huella or huella like v_yo::text || '|%|' || v_sesion)
  ) then
    return;
  end if;

  select count(*) into v_en_total
    from avisos
   where autor = v_yo and creado > now() - interval '24 hours';
  if v_en_total >= 30 then
    raise exception 'demasiados avisos';
  end if;

  insert into avisos (liga, autor, clase, puntos, tono, huella)
  values (null, v_yo, 'sesion', p_puntos, p_tono, v_huella)
  on conflict (huella) do nothing;
end;
$$;

revoke execute on function anotar_aviso(uuid, text, int, text, text) from public, anon;
grant execute on function anotar_aviso(uuid, text, int, text, text) to authenticated;

-- ── 3. `destinatarios_de`: la sesión va a los amigos ──────────────────────────
-- Tres ramas. (1) Avisos DE LIGA (liderato, y las sesiones antiguas por liga): miembros con avisos
-- activos. (2) Personales: su destinatario. (3) Sesión sin liga: los AMIGOS del autor con los avisos
-- activos. El `union` quita duplicados de token. Sin `miembros.avisos` en la rama 3: el interruptor
-- por liga es de la liga; el de los avisos de amigos es el global del perfil.
create or replace function destinatarios_de(p_aviso uuid)
returns table (push_token text)
language sql
security definer
set search_path = public
stable
as $$
  select pe.push_token
  from avisos a
  join miembros m on a.destinatario is null and a.liga is not null
                 and m.liga = a.liga and m.usuario <> a.autor and m.avisos
  join perfiles pe on pe.id = m.usuario and pe.avisos
  where a.id = p_aviso and pe.push_token is not null
  union
  select pe.push_token
  from avisos a
  join perfiles pe on pe.id = a.destinatario and pe.avisos
  where a.id = p_aviso and a.destinatario is not null and a.destinatario <> a.autor
    and pe.push_token is not null
  union
  select pe.push_token
  from avisos a
  join amistades am on am.estado = 'aceptada' and (am.de = a.autor or am.a = a.autor)
  join perfiles pe on pe.id = case when am.de = a.autor then am.a else am.de end and pe.avisos
  where a.id = p_aviso and a.clase = 'sesion' and a.liga is null and a.destinatario is null
    and pe.push_token is not null;
$$;

-- Como en la 08: la llama solo la Edge Function con service_role.
revoke execute on function destinatarios_de(uuid) from public, anon, authenticated;
grant execute on function destinatarios_de(uuid) to service_role;

commit;

-- ── Checklist tras aplicar (en una transacción con rollback, con sesión de un miembro) ────
-- 1. `select anotar_aviso(null, 'sesion', 40, 'normal', 'prueba-mig14');` → inserta una fila con
--    liga null y tono 'normal'. `select count(*) from destinatarios_de(<ese id>)` = nº de amigos
--    con avisos y token. `rollback` después.
-- 2. `select anotar_aviso('<liga mia>', 'sesion', 40, 'fuerte', '<liga>|prueba-mig14');` (formato del
--    cliente viejo) → NO inserta otra: misma sesión.
-- 3. `select anotar_aviso(null, 'sesion', 40, 'raro', 'x');` → 'tono no valido'.
-- 4. `select anotar_aviso(null, 'liderato', 40, 'fuerte', 'x');` → 'clase no valida'.
-- 5. `select count(*) from pg_proc where proname in ('anotar_aviso','destinatarios_de');` → 2.
-- 6. `select hay_demo();` → 0 (regla de la casa).
