-- ── Migración 07: el webhook de avisos, la pieza que faltaba del cartero ──────────
--
-- ⭐ El aviso se ESCRIBE primero en `avisos` (patrón de Dizkarte) y este trigger dispara la
-- Edge Function `enviar-aviso`, que es quien habla con Expo Push. Sin este trigger los
-- avisos quedan anotados como 'pendiente' para siempre: la app cliente y la función estaban
-- terminadas, pero nadie llamaba a la puerta. Verificado el 10 sep 2026: la función
-- desplegada responde 401 sin secreto y 200/suprimido con él.
--
-- ⚠️ [[SECRETO]] se sustituye por el WEBHOOK_SECRETO real ANTES de pegar esto en el SQL
-- Editor. El valor vive en los secretos de la Edge Function y NUNCA en este repo, que es
-- público. Mismo criterio que la SERVICE_ROLE en `.env.example`.
--
-- ⚠️ Si `supabase_functions.http_request` no existe, activa una vez Database → Webhooks
-- («Enable webhooks») en el panel: esa palanca crea el esquema.
--
-- ⚠️ Los avisos anotados ANTES de crear el trigger no se reenvían: el webhook solo dispara
-- con inserciones nuevas. Es lo correcto: reenviar avisos de hace días sería ruido.
--
-- Idempotente: se puede pegar dos veces.

drop trigger if exists avisos_webhook on public.avisos;

create trigger avisos_webhook
  after insert on public.avisos
  for each row
  execute function supabase_functions.http_request(
    'https://vrmfvjtwyaofkqpvpbmx.supabase.co/functions/v1/enviar-aviso',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secreto":"[[SECRETO]]"}',
    '{}',
    '5000'
  );
