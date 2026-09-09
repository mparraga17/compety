-- Poblar los usuarios demo. Se ejecuta DESPUES de `migracion-04-demo.sql`.
--
-- COMO SE USA, en el editor SQL del panel de Supabase:
--   1. Carga `migracion-04-demo.sql` una sola vez (crea las funciones).
--   2. Carga este fichero. Es idempotente: ejecutarlo dos veces no duplica nada.
--   3. En el iPhone, busca `demo_marta` en Amigos, agregala y aparece como amiga al instante.
--   4. Invitala a tu liga desde la pantalla de amigos y ya sale en la clasificacion.
--
-- PARA BORRARLO TODO:  select limpiar_demo();
-- PARA COMPROBAR:      select hay_demo();
--
-- ⚠️ Antes de cualquier build de produccion, `hay_demo()` tiene que devolver 0.

-- ── ⭐ Las cifras no son al azar, y ese es el punto ─────────────────────────────
--
-- Cada demo representa un caso que el producto DICE que sabe resolver, asi que verlos en la tabla
-- es la forma de comprobar si es verdad. Es la misma prueba que se hizo en Windows con 58
-- sesiones reales, pero ahora en el telefono y con la UX de verdad.
--
--   demo_marta   88   solo BARRE, y gana.        ⭐ ES LA TESIS DEL PRODUCTO: si Marta no puede
--                                                ganar haciendo solo barre, el handicap no
--                                                funciona y no tenemos producto.
--   demo_sergio  80   solo FUERZA.               La FC ve la mitad del trabajo isometrico, asi
--                                                que sin el factor de modalidad quedaria ultimo.
--   demo_lucia   77   CORRE mucho.               El caso facil: es donde la metrica siempre va
--                                                bien. Sirve de referencia.
--   demo_nacho   52   7 PASEOS suaves.           ⭐ EL CONTROL NEGATIVO: tiene MAS sesiones que
--                                                nadie y queda ultimo. Si Nacho gana, el ranking
--                                                vuelve a premiar la frecuencia, que es el fallo
--                                                que ya se corrigio tres veces.
--   demo_carmen  61   GOLF, 4 h por ronda.       Volumen enorme e intensidad baja. Comprueba que
--                                                la compresion del volumen (exponente 0,65)
--                                                sigue en su sitio.
--
-- El orden esperado es 88 · 80 · 77 · 61 · 52. Si sale otro, hay algo que mirar en el motor.
-- Y son los MISMOS numeros que dio el motor con datos reales en Windows, asi que la comparacion
-- es directa.

select crear_demo('demo_marta', 'Marta');
select crear_demo('demo_sergio', 'Sergio');
select crear_demo('demo_lucia', 'Lucía');
select crear_demo('demo_nacho', 'Nacho');
select crear_demo('demo_carmen', 'Carmen');

-- ⭐ Uno que NO acepta, para poder ver el estado "pendiente" en la interfaz.
-- Sin este, la bandeja de peticiones enviadas nunca se puede probar: todos los demas aceptan al
-- instante y ese estado no se llegaria a ver nunca.
select crear_demo('demo_pendiente', 'Álvaro', false);

-- ── Meterlos en tus ligas y ponerles puntuacion ─────────────────────────────────
-- Se hace para TODAS tus ligas, asi que basta con crear la liga en el iPhone y ejecutar esto.
--
-- ⚠️ `demo_pendiente` queda fuera a proposito: no es amigo tuyo, asi que no deberia poder entrar
-- en tu liga. Meterlo aqui rompería lo que se quiere probar.
do $$
declare
  v_liga record;
begin
  for v_liga in select id, deporte from ligas loop
    perform demo_puntua_todo('demo_marta', v_liga.id, 88, 5, 'fuerte');
    perform demo_puntua_todo('demo_sergio', v_liga.id, 80, 4, 'normal');
    perform demo_puntua_todo('demo_lucia', v_liga.id, 77, 5, 'normal');
    perform demo_puntua_todo('demo_carmen', v_liga.id, 61, 3, 'suave');
    -- Nacho con 7 sesiones y la puntuacion mas baja: es el control negativo.
    perform demo_puntua_todo('demo_nacho', v_liga.id, 52, 7, 'suave');
  end loop;
end $$;

-- ── Comprobacion ───────────────────────────────────────────────────────────────
-- Deberia dar 6 perfiles demo y, por cada liga tuya, 5 en la clasificacion mas tu.
select
  (select hay_demo()) as perfiles_demo,
  (select count(*) from ligas) as tus_ligas,
  (select count(*) from puntuaciones p join perfiles pe on pe.id = p.usuario where pe.demo)
    as filas_de_puntuacion;
