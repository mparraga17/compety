-- Migración 12 · INTEGRIDAD: hallazgos de la revisión de código completa (15 sep 2026, tarde)
--
-- Origen: revisión estilo senior SDE de todo el repo (cliente + SQL + Edge Function). Cada
-- bloque nombra el fallo que cierra y el escenario en que se producía. Ninguno exige cambios
-- en la app instalada: el build 8 sigue funcionando igual con esta migración aplicada.
--
-- ⛔ NO APLICADA a producción al escribirse. Se aplica con:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-12-integridad.sql
--
-- Después de aplicar, comprobar (checklist al final del fichero).
--
-- Idempotente: se puede pegar dos veces.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. ⛔⛔ P0 · Borrar tu cuenta destruía las ligas que creaste, con los datos de TODOS ──
--
-- `ligas.creador` era `not null ... on delete cascade`. El borrado de cuenta (obligatorio por
-- Apple, un toque en Perfil) borraba la fila de la liga y, en cascada, los miembros,
-- puntuaciones y avisos de todos sus miembros. En las ligas de zona el "creador" es simplemente
-- la primera persona que entró en esa división (`unirse_zona_interna`): su baja aniquilaba una
-- división pública de hasta 30 desconocidos con su palmarés. No hace falta malicia: con el
-- churn normal de una beta iba a pasar solo.
--
-- Arreglo: `creador` pasa a ser opcional y la FK a `on delete set null`. La liga sobrevive a su
-- creador; nada en la app ni en las políticas depende de que `creador` tenga valor (solo se
-- escribe al crear). El nombre de la FK se busca en el catálogo por si no es el generado por
-- defecto.
do $$
declare
  v_nombre text;
begin
  select c.conname into v_nombre
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.ligas'::regclass
     and c.contype = 'f'
     and a.attname = 'creador';
  if v_nombre is not null then
    execute format('alter table public.ligas drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.ligas alter column creador drop not null;
alter table public.ligas add constraint ligas_creador_fkey
  foreign key (creador) references auth.users(id) on delete set null;

-- ── 2. ⛔ P0 · Spam de push a toda una liga desde una cuenta cualquiera ─────────
--
-- `anotar_aviso` aceptaba la `huella` que mandara el cliente, así que la deduplicación no
-- protegía de nadie que quisiera abusar: un bucle de RPC con huellas aleatorias era un push
-- ilimitado a todos los miembros de la liga (30 desconocidos en una división de zona), con
-- contenido fabricado, y sin ningún límite de ritmo. Además de la molestia, quema la cuota de
-- Expo y arriesga una sanción de Apple por notificaciones abusivas.
--
-- Tres candados, del más barato al más estructural:
--   a) Cupo por persona: 10 avisos por liga y 30 en total cada 24 h. Un uso legítimo genera como
--      mucho un par al día por liga (solo las sesiones "fuertes" para uno mismo avisan), así que
--      el cupo no lo toca nadie de buena fe y acota el daño de cualquier otro.
--   b) Solo la clase 'sesion' desde el cliente. La app nunca ha enviado 'liderato' (el aviso de
--      cambio de liderato está diseñado pero no construido) y dejarlo abierto permitía a
--      cualquiera anunciar "X se pone primero con 999 puntos" sin que el servidor lo comprobara.
--      Se reabre el día que el servidor lo calcule él mismo.
--   c) La huella se cualifica con el autor en el servidor: nadie puede "gastar" la huella de otra
--      persona ni colisionar con ella. Es transparente para la app, que sigue mandando
--      `liga|sesion`.
--
-- Los avisos repetidos por la misma huella (la sincronización se repite a menudo) siguen sin
-- consumir cupo: chocan en el índice único y no insertan nada.
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
  v_huella text;
  v_en_liga int;
  v_en_total int;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if not es_miembro(p_liga, v_yo) then
    raise exception 'no estas en esa liga';
  end if;
  if p_clase is distinct from 'sesion' then
    raise exception 'clase no valida';
  end if;
  if p_huella is null or char_length(p_huella) not between 1 and 120 then
    raise exception 'huella no valida';
  end if;

  -- Una sesion normal o suave no molesta a nadie. Solo avisa la que fue fuerte PARA TI.
  if p_tono is distinct from 'fuerte' then
    return;
  end if;

  v_huella := v_yo::text || '|' || p_huella;

  -- Repetir la misma huella es la sincronizacion repitiendose: no cuenta ni inserta. Se mira
  -- tambien la huella SIN cualificar, que es como quedaron las filas anteriores a esta
  -- migracion: sin eso, la primera sincronizacion tras aplicarla reavisaria una vez de la ultima
  -- sesion fuerte de cada liga. Nadie puede fabricar ya filas con ese formato (todas las nuevas
  -- llevan el autor delante), asi que solo afecta a lo que ya existe.
  if exists (select 1 from avisos where huella in (v_huella, p_huella)) then
    return;
  end if;

  select count(*) into v_en_liga
    from avisos
   where autor = v_yo and liga = p_liga and creado > now() - interval '24 hours';
  select count(*) into v_en_total
    from avisos
   where autor = v_yo and creado > now() - interval '24 hours';
  if v_en_liga >= 10 or v_en_total >= 30 then
    raise exception 'demasiados avisos';
  end if;

  insert into avisos (liga, autor, clase, puntos, tono, huella)
  values (p_liga, v_yo, p_clase, p_puntos, p_tono, v_huella)
  on conflict (huella) do nothing;
end;
$$;

-- El cupo se calcula contando por autor y fecha: sin este índice sería un recorrido de la
-- tabla entera en cada aviso.
create index if not exists avisos_autor_creado on avisos (autor, creado desc);

-- ── 3. ⚠️ P1 · Fabricar puntuaciones de semanas pasadas y congelar la actual ────
--
-- Dos huecos en `puntuaciones`, que la app escribe DIRECTAMENTE (decisión de arquitectura: la
-- puntuación se calcula en el teléfono para que los datos de salud no suban):
--
--   · `periodo` no tenía ningún límite. Se podían insertar filas `wtd` de CUALQUIER semana pasada
--     con 1000 puntos y luego llamar a `cerrar_periodos` para congelarlas: un palmarés entero
--     fabricado a posteriori (`palmares`, `semanas_ganadas`) y ascensos de división corrompidos.
--     La app legítima escribe siempre `periodo = hoy` (en la hora local del teléfono), así que
--     acotarlo a ±2 días del servidor cubre cualquier huso y corta el resto.
--   · La política de UPDATE permitía tocar cualquier columna de la fila propia, incluida
--     `cerrado`: poner `cerrado = true` a mano congelaba la semana EN CURSO en su pico. (La
--     migración 10 acotó la fecha de `cerrar_periodos`, pero no este camino directo.) Y también
--     permitía mover la fila a otra liga, ventana o periodo mientras no estuviera cerrada.
--
-- Arreglo en dos capas, la misma técnica que la migración 10:
--   · Privilegio por columnas: `cerrado` deja de ser escribible desde la app. El upsert de la app
--     lista exactamente las ocho columnas que se conceden (PostgREST genera `on conflict do update
--     set` con TODAS las del cuerpo, incluidas las de la clave: por eso van en el grant).
--     `cerrar_periodos` es SECURITY DEFINER y no le afecta.
--   · Disparador: al insertar, `periodo` dentro de ±2 días del servidor; al actualizar, la clave
--     (liga, usuario, horizonte, periodo) no cambia. Solo para escrituras CON sesión: las
--     funciones de la demo (service_role, sin `auth.uid()`) siguen pudiendo poblar semanas
--     pasadas, y `cerrar_periodos` solo toca `cerrado`, que el disparador no mira.
revoke update on table public.puntuaciones from authenticated, anon;
grant update (liga, usuario, horizonte, periodo, puntos, sesiones, tono, actualizado)
  on table public.puntuaciones to authenticated;

create or replace function protege_puntuacion()
returns trigger
language plpgsql
as $$
begin
  -- Sin sesion es el tooling de servicio (demo, mantenimiento): no se limita.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.periodo is null or new.periodo not between current_date - 2 and current_date + 2 then
      raise exception 'periodo fuera de rango';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.liga <> old.liga
       or new.usuario <> old.usuario
       or new.horizonte <> old.horizonte
       or new.periodo <> old.periodo then
      raise exception 'la clave de una puntuacion no se cambia';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists puntuaciones_integras on puntuaciones;
create trigger puntuaciones_integras
  before insert or update on puntuaciones
  for each row execute function protege_puntuacion();

-- ── 4. ⚠️ P2 · La política de lectura de `avisos` se quedó en la migración 07 ─────
--
-- La 08 generalizó `avisos` para que también fueran A UNA PERSONA (amistad, reacción,
-- comentario), con `liga` a null. La política de SELECT siguió siendo `es_miembro(liga, ...)`,
-- que con `liga` null es falso: un aviso personal no lo podía leer ni su destinatario. La app no
-- lee la tabla hoy (los avisos llegan por push), así que no era un fallo visible, pero el modelo
-- de seguridad tiene que describir la realidad: quién puede ver qué.
drop policy if exists "avisos: los de tus ligas" on avisos;
drop policy if exists "avisos: los de tus ligas o para ti" on avisos;
create policy "avisos: los de tus ligas o para ti" on avisos
  for select using (
    (liga is not null and es_miembro(liga, auth.uid()))
    or destinatario = auth.uid()
    or autor = auth.uid()
  );

-- ── 5. Higiene de EXECUTE: las funciones del esquema base que nunca se revocaron ────
--
-- La regla de la casa (revocar de PUBLIC primero) nació en la migración 02; las funciones del
-- esquema original no la recibieron. Todas fallan cerradas con `anon` (exigen `auth.uid()`), así
-- que no filtraban nada, pero `es_miembro` es además un ORÁCULO: acepta dos uuids cualesquiera y
-- responde si esa persona está en esa liga. Sin sesión ya no se puede preguntar. (Con sesión sí,
-- porque las políticas de RLS se evalúan con el rol de quien consulta y necesitan EXECUTE;
-- cerrarlo del todo exigiría reescribir las políticas, y el valor de la pregunta para alguien
-- que ya tiene que conocer los dos uuids es bajo. Queda anotado.)
revoke execute on function es_miembro(uuid, uuid) from public, anon;
grant execute on function es_miembro(uuid, uuid) to authenticated;

revoke execute on function entrar_en_liga(text) from public, anon;
grant execute on function entrar_en_liga(text) to authenticated;

revoke execute on function borrar_mi_cuenta() from public, anon;
grant execute on function borrar_mi_cuenta() to authenticated;

revoke execute on function anotar_aviso(uuid, text, int, text, text) from public, anon;
grant execute on function anotar_aviso(uuid, text, int, text, text) to authenticated;

revoke execute on function cerrar_periodos(date) from public, anon;
grant execute on function cerrar_periodos(date) to authenticated;

-- ── Lo que se revisó y NO se toca en esta migración, para que conste ─────────────
--
-- · Puntuaciones calculadas en el cliente: riesgo ACEPTADO por arquitectura (migración 10). Con
--   esta migración un tramposo puede inflar su semana EN CURSO hasta 1000; ya no puede fabricar
--   semanas pasadas ni congelar la actual. Detectar el inflado (puntos/sesiones implausibles)
--   es trabajo futuro y necesita datos de varios usuarios para fijar el umbral.
-- · `invitar_a_liga` mete al amigo sin su aceptación: decisión de producto pendiente (10).
-- · `es_miembro` como oráculo con sesión: ver el bloque 5.
-- · Fuerza bruta de códigos de liga: sin límite de intentos (10). El cupo de este fichero es un
--   patrón reutilizable para `entrar_en_liga` (contar fallos por persona y hora) cuando toque.
--
-- ── Checklist tras aplicar (dashboard o `db query`) ─────────────────────────────
--
-- 1. `select is_nullable from information_schema.columns where table_name='ligas' and column_name='creador';`
--    → YES. Y `select confdeltype from pg_constraint where conname='ligas_creador_fkey';` → 'n' (set null).
-- 2. Con la anon key y una sesión real: sincronizar desde la app (build 8) tiene que seguir
--    escribiendo puntuaciones sin 42501, y `update puntuaciones set cerrado = true where usuario =
--    auth.uid()` tiene que dar 42501.
-- 3. `select anotar_aviso('<liga>', 'liderato', 100, 'fuerte', 'x');` con sesión → 'clase no valida'.
-- 4. `select count(*) from pg_policies where tablename='avisos';` → 1, la nueva.
-- 5. `select hay_demo();` → 0 antes de cualquier build (regla de la casa, no cambia con esta migración).
