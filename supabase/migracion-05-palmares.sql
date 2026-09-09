-- Migración 05: cierres de semana, mes y año, y palmarés.
--
-- ⭐ POR QUÉ EXISTE: la competición no terminaba nunca. El horizonte por defecto es una
-- ventana móvil que no se cierra, y aunque `cerrar_periodos` congela filas, ningún sitio
-- mostraba un RESULTADO. Una liga sin jornadas es una clasificación que fluctúa para
-- siempre: nadie gana, nadie vuelve el lunes a ver quién ganó. El ciclo de Duolingo que
-- cita PRODUCTO.md (cohortes, ranking de 7 días, resolución) funciona por la resolución.
--
-- Decisión del usuario (7 sep): cierre de SEMANA, de MES y de AÑO, y en el del año un
-- ranking de quién ganó más semanas. Largo plazo: la semana da el ritmo, el mes la
-- tendencia y el año la historia.
--
-- ⚠️ SIN TABLA NUEVA. Los resultados se DERIVAN de `puntuaciones`, que ya guarda una fila
-- por (liga, usuario, horizonte, periodo) con `cerrado = true` al pasar el día. La fila
-- con el periodo más alto de cada usuario dentro de una semana ES su resultado final de
-- esa semana. Materializarlo en otra tabla duplicaría datos que ya existen y añadiría un
-- proceso de cierre que puede fallar; derivarlo es idempotente por construcción.

-- ── Resultados finales de cada periodo cerrado ─────────────────────────────────
-- Para cada usuario y cada tramo (semana/mes/año), su última fila cerrada del horizonte
-- de calendario correspondiente: wtd para semanas, mtd para meses, ytd para años.
--
-- ⚠️ `p_hoy` viene de la app en fecha LOCAL de quien pregunta, igual que en
-- `cerrar_periodos`: el tramo solo aparece cuando YA TERMINÓ para esa persona. Sin este
-- filtro, los días intermedios de la semana en curso (que ya están cerrados uno a uno)
-- generarían un "ganador" provisional de una semana aún viva.
create or replace function palmares(p_liga uuid, p_horizonte text, p_hoy date)
returns table (
  inicio date,
  usuario uuid,
  nombre text,
  puntos int,
  sesiones int,
  -- Puesto dentro del tramo: 1 es el ganador. Se devuelven todos, no solo el primero,
  -- para que la app pueda pintar el podio completo del cierre.
  puesto bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trunc text;
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;

  v_trunc := case p_horizonte
    when 'wtd' then 'week'   -- date_trunc('week') es lunes ISO, igual que la app.
    when 'mtd' then 'month'
    when 'ytd' then 'year'
    else null
  end;
  if v_trunc is null then
    raise exception 'ese horizonte no tiene cierre';
  end if;

  return query
  with finales as (
    -- La última fila cerrada de cada usuario dentro de cada tramo: su resultado final.
    select distinct on (date_trunc(v_trunc, p.periodo), p.usuario)
      date_trunc(v_trunc, p.periodo)::date as tramo,
      p.usuario as quien,
      p.puntos as pts,
      p.sesiones as ses
    from puntuaciones p
    where p.liga = p_liga
      and p.horizonte = p_horizonte
      and p.cerrado
      -- Solo tramos TERMINADOS según la fecha local del que pregunta.
      and (date_trunc(v_trunc, p.periodo) + ('1 ' || v_trunc)::interval)::date <= p_hoy
    order by date_trunc(v_trunc, p.periodo), p.usuario, p.periodo desc
  )
  select
    f.tramo,
    f.quien,
    pe.nombre,
    f.pts,
    f.ses,
    rank() over (partition by f.tramo order by f.pts desc)
  from finales f
  join perfiles pe on pe.id = f.quien
  order by f.tramo desc, f.pts desc;
end;
$$;

-- ── Ranking anual: quién ganó más semanas ──────────────────────────────────────
-- Lo pidió el usuario para el cierre de año: la historia de la temporada no es quién
-- sumó más puntos en diciembre, es quién ganó más jornadas. Como en el tenis: los
-- títulos cuentan más que los puntos de un torneo.
--
-- ⚠️ Los empates cuentan para todos los empatados (rank() = 1 compartido). Es lo
-- generoso, y con puntuaciones de 0-115 los empates reales serán raros.
create or replace function semanas_ganadas(p_liga uuid, p_anio int, p_hoy date)
returns table (usuario uuid, nombre text, ganadas bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_miembro(p_liga, auth.uid()) then
    raise exception 'no estas en esa liga';
  end if;

  return query
  with todas as (
    select * from palmares(p_liga, 'wtd', p_hoy)
  )
  select t.usuario, t.nombre, count(*) as ganadas
  from todas t
  where t.puesto = 1
    and extract(year from t.inicio)::int = p_anio
  group by t.usuario, t.nombre
  order by ganadas desc;
end;
$$;
