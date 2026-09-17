/**
 * Borrado de cuenta con revocación de Sign in with Apple. La llama la app con el JWT del usuario.
 *
 * ⭐ Existe por la guía 5.1.1(v) de Apple y su página "Offering account deletion in your app": una
 * app con Sign in with Apple tiene que revocar los tokens del usuario al borrar la cuenta. Hasta el
 * 16 sep la app llamaba a `borrar_mi_cuenta()` directamente y no revocaba nada: rechazo seguro en la
 * revisión del App Store. Supabase Auth no lo hace por nadie (supabase/auth#1308, cerrado).
 *
 * El orden importa, y es una decisión:
 *
 *   1. Quién llama lo dice el JWT (`/auth/v1/user`), nunca el cuerpo. Es lo que impide que alguien
 *      borre la cuenta de otro. El gateway ya verifica la firma del JWT (esta función va CON
 *      verificación, a diferencia de `enviar-aviso`, que la llama la base de datos con secreto propio).
 *   2. Si la cuenta entró con Apple, se revoca PRIMERO con el `authorizationCode` fresco que manda la
 *      app (ver `apple.ts`). Si Apple falla, se devuelve el error y NO se borra: la persona reintenta,
 *      y una mala configuración (`invalid_client`) sale a la luz en vez de dejar cuentas borradas con
 *      la autorización de Apple viva. Es la alternativa a lo que hacen otros ("best effort" y seguir).
 *   3. Solo entonces se llama a `borrar_mi_cuenta()` (esquema.sql), la MISMA función SQL que usaba la
 *      app, con el JWT del usuario: un único camino de borrado, y esta función no necesita la clave
 *      de servicio para nada.
 *
 * Secretos (`supabase secrets set`, nunca en el repo): APPLE_TEAM_ID, APPLE_CLIENT_ID (el bundle),
 * APPLE_KEY_ID y APPLE_PRIVATE_KEY_B64 (el .p8 entero en base64, para que un PEM de varias líneas
 * viaje sin romperse). SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase.
 *
 * Respuestas: 200 {ok, apple_revocado} · 400 falta el código (cuenta Apple) · 401 sin usuario ·
 * 405 · 500 secretos sin configurar o borrado fallido · 502 Apple rechazó el canje o la revocación
 * (con `codigo` de Apple: `invalid_grant` = código gastado, pedir otro; `invalid_client` = config).
 */

import { ErrorApple, revocarSignInWithApple, type ConfigApple } from './apple.ts';

type Identidad = { provider?: unknown };
type Usuario = { id: string; identities?: Identidad[] };

function json(estado: number, cuerpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function entorno(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`falta ${nombre}`);
  return valor;
}

/** Los cuatro datos de Apple, leídos en el momento de usarlos: sin ellos no se borra ninguna cuenta Apple. */
function configApple(): ConfigApple {
  return {
    teamId: entorno('APPLE_TEAM_ID'),
    clientId: entorno('APPLE_CLIENT_ID'),
    keyId: entorno('APPLE_KEY_ID'),
    clavePem: atob(entorno('APPLE_PRIVATE_KEY_B64')),
  };
}

/** El usuario del JWT, con sus identidades (para saber si entró con Apple). null si el JWT no vale. */
async function usuarioDe(autorizacion: string): Promise<Usuario | null> {
  const respuesta = await fetch(`${entorno('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: entorno('SUPABASE_ANON_KEY'), Authorization: autorizacion },
  });
  if (!respuesta.ok) return null;
  const usuario = (await respuesta.json()) as Usuario;
  return typeof usuario.id === 'string' ? usuario : null;
}

/** `borrar_mi_cuenta()` como el propio usuario: `auth.uid()` es él, y la cascada hace el resto. */
async function borrarEnBaseDeDatos(autorizacion: string): Promise<Response> {
  return fetch(`${entorno('SUPABASE_URL')}/rest/v1/rpc/borrar_mi_cuenta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: entorno('SUPABASE_ANON_KEY'),
      Authorization: autorizacion,
    },
    body: '{}',
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'metodo' });

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return json(401, { error: 'sin_sesion' });
  const usuario = await usuarioDe(autorizacion);
  if (usuario === null) return json(401, { error: 'sin_sesion' });

  let cuerpo: { apple_authorization_code?: unknown } = {};
  try {
    cuerpo = await req.json();
  } catch {
    // Sin cuerpo: válido para una cuenta que no entró con Apple.
  }
  const codigo =
    typeof cuerpo.apple_authorization_code === 'string' && cuerpo.apple_authorization_code.length > 0
      ? cuerpo.apple_authorization_code
      : null;

  const conApple = (usuario.identities ?? []).some((i) => i.provider === 'apple');
  if (conApple) {
    if (codigo === null) return json(400, { error: 'falta_codigo_apple' });
    let config: ConfigApple;
    try {
      config = configApple();
    } catch (e) {
      console.error('borrar-cuenta: secretos de Apple sin configurar', e);
      return json(500, { error: 'apple_sin_configurar' });
    }
    try {
      await revocarSignInWithApple(config, codigo);
    } catch (e) {
      if (e instanceof ErrorApple) {
        console.error(`borrar-cuenta: Apple rechazó ${e.paso} (${e.estado} ${e.codigo ?? ''}) para ${usuario.id}`);
        return json(502, { error: 'apple_no_revocado', paso: e.paso, codigo: e.codigo });
      }
      console.error('borrar-cuenta: fallo hablando con Apple', e);
      return json(502, { error: 'apple_no_revocado', paso: 'red', codigo: null });
    }
  }

  const borrado = await borrarEnBaseDeDatos(autorizacion);
  if (!borrado.ok) {
    console.error(`borrar-cuenta: borrar_mi_cuenta falló (${borrado.status}) para ${usuario.id}: ${await borrado.text()}`);
    return json(500, { error: 'no_borrado' });
  }

  return json(200, { ok: true, apple_revocado: conApple });
});
