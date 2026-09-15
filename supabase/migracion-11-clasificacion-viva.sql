-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 11 · La clasificación no borra a quien no sincronizó HOY
--
-- EL BUG (reportado por el usuario el 15 sep: «a veces no me aparece Sergio en Chavales
-- Z72»). Diagnóstico con datos de producción, no supuesto: Sergio ES miembro desde el 11,
-- pero su última sincronización fue el 14 y la de Manuel el 15. `clasificacion` filtraba
-- `periodo = p_periodo` EXACTO (hoy), así que solo aparecía quien había abierto la app (o
-- sincronizado en segundo plano) ese mismo día. Cada miembro escribe su fila con
-- `periodo = su día local` al sincronizar ⇒ la tabla era «quién sincronizó hoy», no la liga.
--
-- EL ARREGLO: para cada miembro ACTUAL de la liga, su última fila del horizonte dentro de
-- la ventana que toca (semana/mes/año en curso para wtd/mtd/ytd; últimos 7/30 días para
-- d7/d30). Quien sincronizó el lunes sigue en la tabla el jueves, con su último dato
-- conocido; se refresca solo cuando su teléfono vuelva a subir.
--
-- Decisiones deliberadas, que nadie las «arregle» sin pensar:
--   · Un miembro sin NINGUNA fila en la ventana sigue sin aparecer. Así el estado vacío de
--     una liga recién creada (el CTA «invita a alguien») se conserva, y quien lleva un mes
--     inactivo no ocupa la tabla con un dato viejísimo.
--   · Se cruza con `miembros`: quien se fue de la liga deja de aparecer al instante aunque
--     sus filas históricas se queden donde se jugaron (palmarés intacto).
--   · Las filas `cerrado = true` dentro de la ventana VALEN: son el último dato conocido.
--     El truco de congelarse en el pico quedó acotado por el candado ±2 días de la
--     migración 10.
--   · Misma firma y mismas columnas de salida: los builds ya instalados la llaman igual.
--
-- ⚠️ Los nombres de salida (usuario, puntos…) son variables dentro del cuerpo: todo va
-- cualificado o con alias, la lección 42702 de la migración 03.
--
-- Idempotente. Se aplica con:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-11-clasificacion-viva.sql
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function clasificacion(p_liga uuid, p_horizonte text, p_periodo date)
returns table (usuario uuid, nombre text, puntos int, sesiones int, tono text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;
  -- Coherente con la migración 10: la fecha viene del teléfono y se acota al huso real.
  if p_periodo is null or p_periodo not between current_date - 2 and current_date + 2 then
    raise exception 'fecha fuera de rango';
  end if;

  v_desde := case p_horizonte
    when 'wtd' then date_trunc('week', p_periodo::timestamp)::date   -- lunes ISO, como la app
    when 'mtd' then date_trunc('month', p_periodo::timestamp)::date
    when 'ytd' then date_trunc('year', p_periodo::timestamp)::date
    when 'd7' then p_periodo - 6
    when 'd30' then p_periodo - 29
    else null
  end;
  if v_desde is null then
    raise exception 'horizonte no valido';
  end if;

  return query
    with ultimas as (
      -- La última fila de cada miembro dentro de la ventana. DISTINCT ON exige que el
      -- ORDER BY empiece por lo agrupado; el orden final lo pone la consulta de fuera.
      select distinct on (p.usuario)
        p.usuario as quien,
        p.puntos as pts,
        p.sesiones as ses,
        p.tono as tn,
        p.actualizado as act
      from puntuaciones p
      join miembros m on m.liga = p.liga and m.usuario = p.usuario
      where p.liga = p_liga
        and p.horizonte = p_horizonte
        and p.periodo between v_desde and p_periodo
      order by p.usuario, p.periodo desc
    )
    select u.quien, pe.nombre, u.pts, u.ses, u.tn
    from ultimas u
    join perfiles pe on pe.id = u.quien
    order by u.pts desc, u.act asc;
end;
$$;

-- La 05 enseñó a no fiarse del EXECUTE heredado de PUBLIC: se deja explícito.
revoke execute on function clasificacion(uuid, text, date) from public, anon;
grant execute on function clasificacion(uuid, text, date) to authenticated;
