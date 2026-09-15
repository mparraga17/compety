-- ══════════════════════════════════════════════════════════════════════════════
-- Migración 10 · ENDURECIMIENTO: hallazgos de la revisión de seguridad (15 sep 2026)
--
-- Origen: primera pasada de seguridad sistemática de la app, con los criterios de
-- Claude Code Security (Anthropic), la disciplina de trailofbits/skills (ningún hallazgo
-- sin rastrear hasta una decisión de seguridad real) y el checklist de
-- supabase-pentest-skills. Cada bloque nombra el ataque que cierra.
--
-- ⛔ NO APLICADA a producción al escribirse. Se aplica con:
--   npx supabase db query --linked --project-ref vrmfvjtwyaofkqpvpbmx -o json -f supabase/migracion-10-endurecimiento.sql
--
-- Idempotente: se puede pegar dos veces.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. ⛔⛔ P1 · Saltarse el código de liga moviendo tu propia fila de `miembros` ─
--
-- EL ATAQUE, rastreado y confirmado en el esquema:
--   La política «miembros: editar lo tuyo» limita el UPDATE por FILA (auth.uid() = usuario),
--   pero no por COLUMNA, y Supabase concede por defecto UPDATE sobre todas las columnas a
--   `authenticated`. RLS sin WITH CHECK reutiliza el USING para la fila nueva, que sigue
--   cumpliéndose porque `usuario` no cambia. Resultado: cualquiera puede ejecutar
--
--     update miembros set liga = '<uuid de otra liga>' where usuario = auth.uid();
--
--   y TELETRANSPORTARSE a una liga privada ajena sin código ni invitación: vería su
--   clasificación y, por `ve_entrenos_de`, el feed de entrenos de sus miembros.
--
--   ¿De dónde saca el uuid de una liga ajena? No es adivinable (uuid v4), pero SÍ viaja: va
--   en el `data.liga` de cada push (visible en el payload), lo conoce cualquier ex-miembro,
--   y las capturas de depuración lo enseñan. «No adivinable» no es «secreto».
--
-- EL ARREGLO: privilegio por columnas. El único UPDATE directo que hace la app sobre
-- `miembros` es la preferencia de avisos (ligas.ts:403). Todo lo demás (entrar, salir de
-- zona, ascensos) pasa por funciones SECURITY DEFINER, que corren como el dueño de la
-- función y no les afecta este revoke.
revoke update on table public.miembros from authenticated, anon;
grant update (avisos) on table public.miembros to authenticated;

-- ── 2. ⚠️ P3 · Mismo patrón en `perfiles`: columnas que no debe tocar la app ────
--
-- El UPDATE de fila propia estaba abierto a TODAS las columnas, incluidas `usuario` (que
-- debe pasar por `elegir_usuario`, aunque el CHECK y el índice único aguantan solos),
-- `demo` y `auto_acepta` (ponerse `demo = true` a uno mismo haría que `limpiar_demo()` te
-- borrara la cuenta: autolesión, pero gratuita).
--
-- La app actualiza: nombre (cuenta.ts, vía upsert), push_token (push.ts), y deja avatar y
-- avisos para lo ya previsto. El INSERT no se toca: la política «perfil propio: crear» ya
-- exige id = auth.uid().
--
-- ⚠️ `id` va EN el grant a propósito: el upsert de `guardarNombre` hace que PostgREST genere
-- `on conflict do update set id = excluded.id, nombre = ...`, y sin UPDATE sobre `id` ese
-- camino da 42501 justo cuando el perfil ya existe (el caso normal). Es inofensivo: la
-- política de UPDATE (USING reutilizado como WITH CHECK) impide que `id` acabe siendo otro
-- distinto de auth.uid().
revoke update on table public.perfiles from authenticated, anon;
grant update (id, nombre, avatar, push_token, avisos) on table public.perfiles to authenticated;

-- ── 3. ⚠️ P2 · `palmares` y `semanas_ganadas` sin revoke (migración 05) ─────────
--
-- La migración 05 es la ÚNICA que olvidó la regla de la casa: revocar de PUBLIC primero.
-- Postgres regala EXECUTE a PUBLIC al crear una función, así que `anon` puede llamarlas.
-- No filtran datos (la primera línea exige es_miembro y con anon `auth.uid()` es null),
-- pero quedan fuera de la convención y responden con error en vez de con 404 de función.
revoke execute on function palmares(uuid, text, date) from public, anon;
revoke execute on function semanas_ganadas(uuid, int, date) from public, anon;
grant execute on function palmares(uuid, text, date) to authenticated;
grant execute on function semanas_ganadas(uuid, int, date) to authenticated;

-- ── 4. ⚠️ P2 · Fechas del cliente sin acotar: congelar tu semana EN CURSO ───────
--
-- `cerrar_periodos(p_hoy)` se fía de la fecha que manda el teléfono. Pasando una fecha
-- futura congelas tu fila de la semana EN CURSO en su pico: el trigger `no_tocar_cerradas`
-- impide que baje aunque tus sesiones envejezcan fuera de la ventana. Es un truco de
-- clasificación, no una fuga, pero rompe la equidad que sostiene el producto.
--
-- Se acota a ±2 días de la fecha del servidor: cubre cualquier huso real (UTC-12..UTC+14)
-- y corta la fecha inventada. Mismo candado en `aplicar_movimientos`.
create or replace function cerrar_periodos(p_hoy date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  if p_hoy is null or p_hoy not between current_date - 2 and current_date + 2 then
    raise exception 'fecha fuera de rango';
  end if;

  update puntuaciones
     set cerrado = true
   where usuario = auth.uid()
     and not cerrado
     and periodo < p_hoy;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- `aplicar_movimientos` con el mismo candado de fecha. El cuerpo es el de la migración 06
-- sin más cambios: solo se añade la validación de p_hoy.
create or replace function aplicar_movimientos(p_hoy date)
returns table (mov_ciudad text, mov_distrito text, mov_semana date, mov_de int, mov_a int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana date := (date_trunc('week', p_hoy::timestamp))::date - 7;
  v_zona uuid;
begin
  if auth.uid() is null then
    raise exception 'hace falta sesion';
  end if;
  if p_hoy is null or p_hoy not between current_date - 2 and current_date + 2 then
    raise exception 'fecha fuera de rango';
  end if;

  for v_zona in
    select distinct l.zona
      from miembros m
      join ligas l on l.id = m.liga
     where m.usuario = auth.uid() and l.zona is not null
  loop
    if not exists (
      select 1
        from puntuaciones p
        join ligas l on l.id = p.liga
       where l.zona = v_zona
         and p.horizonte = 'wtd'
         and p.periodo >= v_semana and p.periodo < v_semana + 7
    ) then
      continue;
    end if;

    insert into cierres_zona (zona, semana) values (v_zona, v_semana)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    insert into movimientos (liga, semana, usuario, puesto, de_division, a_division)
    with divisiones as (
      select l.id as liga, l.division
        from ligas l
       where l.zona = v_zona
    ),
    tope as (
      select max(d.division) as ultima from divisiones d
    ),
    finales as (
      select distinct on (p.liga, p.usuario) p.liga, p.usuario, p.puntos
        from puntuaciones p
        join divisiones d on d.liga = p.liga
       where p.horizonte = 'wtd'
         and p.periodo >= v_semana and p.periodo < v_semana + 7
       order by p.liga, p.usuario, p.periodo desc
    ),
    tabla as (
      select d.liga,
             d.division,
             m.usuario,
             row_number() over (
               partition by d.liga
               order by coalesce(f.puntos, 0) desc, m.entro asc
             ) as puesto,
             count(*) over (partition by d.liga) as n
        from divisiones d
        join miembros m on m.liga = d.liga
        left join finales f on f.liga = d.liga and f.usuario = m.usuario
    )
    select t.liga,
           v_semana,
           t.usuario,
           t.puesto::int,
           t.division,
           case
             when t.division > 1 and t.puesto <= cuantos_mueven(t.n::int)
               then t.division - 1
             else t.division + 1
           end
      from tabla t, tope x
     where (t.division > 1 and t.puesto <= cuantos_mueven(t.n::int))
        or (t.division < x.ultima and t.puesto > t.n - cuantos_mueven(t.n::int))
    on conflict do nothing;

    update miembros m
       set liga = destino.id
      from movimientos mo
      join ligas origen on origen.id = mo.liga
      join ligas destino on destino.zona = origen.zona and destino.division = mo.a_division
     where mo.semana = v_semana
       and origen.zona = v_zona
       and mo.de_division <> mo.a_division
       and m.liga = mo.liga
       and m.usuario = mo.usuario;
  end loop;

  return query
    select z.ciudad, z.distrito, mo.semana, mo.de_division, mo.a_division
      from movimientos mo
      join ligas l on l.id = mo.liga
      join zonas z on z.id = l.zona
     where mo.usuario = auth.uid()
       and mo.semana = v_semana
       and mo.de_division <> mo.a_division;
end;
$$;

-- ── 5. ⚠️ P2 · `publicar_entrenos`: fechas de entreno sin acotar ────────────────
--
-- El `fin` venía del cliente sin límites: se podían publicar entrenos fechados en 2050 (se
-- clavan arriba del feed para siempre, porque pagina por `fin`) o en 1970. Se salta la fila
-- rara sin tumbar el lote: un reloj desquiciado no debe frenar las puntuaciones. Margen
-- ancho a propósito: la sincronización real publica hasta 30 días hacia atrás.
create or replace function publicar_entrenos(p_entrenos jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_n int := 0;
  v_fin timestamptz;
  e jsonb;
begin
  if v_yo is null then
    raise exception 'hace falta sesion';
  end if;
  if jsonb_typeof(p_entrenos) <> 'array' or jsonb_array_length(p_entrenos) > 60 then
    raise exception 'lote no valido';
  end if;

  for e in select * from jsonb_array_elements(p_entrenos) loop
    v_fin := (e->>'fin')::timestamptz;
    continue when v_fin is null
      or v_fin > now() + interval '1 day'
      or v_fin < now() - interval '90 days';

    insert into entrenos (usuario, huella, deporte, puntos, tono, fin)
    values (
      v_yo,
      v_yo::text || '|' || (e->>'id'),
      nullif(left(e->>'deporte', 40), ''),
      least(1000, greatest(0, (e->>'puntos')::int)),
      e->>'tono',
      v_fin
    )
    on conflict (huella) do update
      set deporte = excluded.deporte, puntos = excluded.puntos, tono = excluded.tono;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- ── Lo que se revisó y NO se toca, para que conste ──────────────────────────────
--
-- · Puntuaciones calculadas en el cliente: riesgo ACEPTADO por arquitectura (la privacidad
--   manda: los datos de salud no suben). Mitigaciones vigentes: CHECK 0-1000, tope de lote,
--   idempotencia por clave. Un tramposo puede inflar sus puntos; no puede tocar los de nadie.
-- · `entrar_en_liga` por fuerza bruta: 32^6 ≈ 1.070 millones de códigos y hace falta sesión.
--   Sin límite de intentos es teóricamente enumerable a escala; con el tamaño actual no es
--   práctico. Recomendación futura: contador de fallos por usuario/hora.
-- · `invitar_a_liga` mete al amigo SIN su aceptación: decisión de producto pendiente, no un
--   agujero técnico (requiere amistad aceptada y pertenencia del invitador). Anotada.
-- · Edge Function: comparación del secreto no constante en tiempo — impracticable de explotar
--   sobre HTTPS con secreto de 32 bytes aleatorios. `marcar()` interpola el id en la URL,
--   pero el payload solo puede fabricarlo quien tiene el secreto del webhook.
-- · Landing `liga.html`: parámetros pintados con textContent y código validado con regex ✓.
-- · Repo público: sin secretos en los 18 commits del historial (patrones JWT/claves/PEM). ✓
