-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 14 — Avisar de TODA sesión de un amigo, no solo de las fuertes
--
-- Decisión de producto (17 sep 2026, del usuario): *"no quiero que sea solo cuando la sesión es
-- fuerte, quiero que sea cuando un amigo ha hecho una sesión"*. Con la regla anterior (solo la
-- última sesión de la semana, y solo si era `fuerte` para quien la hizo), en diez días de beta hubo
-- 25 sesiones de un amigo y UN aviso. Para una app de competir con amigos el silencio pesaba más
-- que el ruido que la regla evitaba.
--
-- Qué cambia aquí: `anotar_aviso` deja de descartar las sesiones `suave` y `normal`. Todo lo demás
-- de la migración 12 se queda tal cual, porque es lo que hace tolerable avisar de todo:
--   · solo la clase 'sesion' desde el cliente;
--   · deduplicación por huella cualificada con el autor (repetir la sincronización no reavisa);
--   · cupo de 10 avisos por liga y 30 en total cada 24 h por persona (el cliente además solo
--     avisa de sesiones terminadas en las últimas 24 h, ver `src/motor/avisos.ts`).
-- El tono sigue siendo obligatorio y válido: lo usa el texto del aviso ("una de sus sesiones más
-- fuertes" frente a "ha entrenado").
--
-- ⚠️ COMPATIBILIDAD: la firma no cambia. El cliente viejo (build 10 sin la OTA) sigue mandando solo
-- la última sesión fuerte; el nuevo manda todas las recientes. Ambos funcionan contra esta versión.
--
-- No destructiva: una función reemplazada. Idempotente: se puede pegar dos veces.
-- Aplicar con:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-14-avisos-toda-sesion.sql
-- ══════════════════════════════════════════════════════════════════════════════

begin;

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
  -- Migración 14: el tono ya no decide si se avisa, pero tiene que ser uno de los tres. Antes aquí
  -- había un `return` para todo lo que no fuera 'fuerte'.
  if p_tono is null or p_tono not in ('suave', 'normal', 'fuerte') then
    raise exception 'tono no valido';
  end if;

  v_huella := v_yo::text || '|' || p_huella;

  -- Repetir la misma huella es la sincronizacion repitiendose: no cuenta ni inserta. Se mira
  -- tambien la huella SIN cualificar, como quedaron las filas anteriores a la migracion 12.
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

-- Misma política de EXECUTE que en la 12: revocar de PUBLIC primero, conceder a authenticated.
revoke execute on function anotar_aviso(uuid, text, int, text, text) from public, anon;
grant execute on function anotar_aviso(uuid, text, int, text, text) to authenticated;

commit;

-- ── Checklist tras aplicar (en una transacción con rollback, con sesión de un miembro) ────
-- 1. `select anotar_aviso('<liga>', 'sesion', 40, 'normal', 'prueba-mig14');` → inserta una fila
--    con tono 'normal' (antes salía sin insertar). `rollback` después.
-- 2. `select anotar_aviso('<liga>', 'sesion', 40, 'raro', 'x');` → 'tono no valido'.
-- 3. `select anotar_aviso('<liga>', 'liderato', 40, 'fuerte', 'x');` → 'clase no valida' (sigue).
-- 4. `select count(*) from pg_proc where proname = 'anotar_aviso';` → 1.
-- 5. `select hay_demo();` → 0 (regla de la casa, no cambia con esta migración).
