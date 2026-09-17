/**
 * Hablar con Apple para revocar un Sign in with Apple. Parte pura de la Edge Function `borrar-cuenta`:
 * sin `Deno.*`, solo WebCrypto y `fetch`, que Deno y Node comparten. Por eso se puede probar en jest.
 *
 * ⭐ Lo exige Apple (guía 5.1.1(v) y su página "Offering account deletion in your app"): una app con
 * Sign in with Apple tiene que revocar los tokens del usuario al borrar la cuenta. Supabase Auth no lo
 * hace por nadie (supabase/auth#1308, cerrado): no guarda los tokens del proveedor.
 *
 * Cómo, según las fuentes primarias de Apple ("Token revocation" y "Creating a client secret"):
 *
 *   1. `clientSecret`: un JWT ES256 firmado con la clave .p8 de "Sign in with Apple" del portal.
 *      Claims: iss = Team ID, sub = client_id, aud = https://appleid.apple.com, iat, exp. Apple admite
 *      hasta seis meses de vida; aquí son CINCO MINUTOS y se firma por petición, así que no hay
 *      ningún secreto que rotar (la rotación semestral es lo que se les olvida a los que lo guardan).
 *   2. `canjearCodigo`: el `authorizationCode` que devuelve el flujo nativo (un solo uso, cinco
 *      minutos) se canjea en `/auth/token` por un `refresh_token`. Apple lo dice tal cual: "si no
 *      tienes ninguno de los dos tokens, genera tokens validando un authorization code".
 *   3. `revocar`: `/auth/revoke` con ese refresh token y `token_type_hint=refresh_token`. Devuelve
 *      200 también si ya estaba revocado: es idempotente, se puede reintentar sin miedo.
 *
 * ⚠️ El `client_id` es el App ID (el bundle, `com.pizcodeploy.compety`), no el Services ID: Apple
 * exige que coincida con el que se usó en la autorización, y el flujo nativo autoriza con el bundle.
 *
 * ⚠️ Por qué NO se guarda el refresh token en el alta, que es lo que hacen otros: sería un token de
 * terceros de larga vida almacenado en nuestro servidor, con su rotación y su riesgo, para usarlo una
 * vez. Pedir Sign in with Apple otra vez justo antes de borrar da un código fresco y además es la
 * confirmación de identidad que Apple permite exigir antes de un borrado.
 *
 * ⚠️ Errores: `ErrorApple` lleva el paso, el estado HTTP y el `error` que devuelve Apple. Los dos
 * que importan en operación: `invalid_grant` = el código está gastado o caducado (la app pide otro);
 * `invalid_client` = el secreto está mal (Team ID, Key ID, clave o client_id): es de configuración.
 */

export type ConfigApple = {
  /** Team ID de diez caracteres, `iss` del secreto. */
  teamId: string;
  /** El App ID (bundle) con el que autorizó el usuario. `sub` del secreto y `client_id`. */
  clientId: string;
  /** Key ID de la clave "Sign in with Apple" del portal. `kid` de la cabecera. */
  keyId: string;
  /** El .p8 tal cual, PEM PKCS#8. */
  clavePem: string;
};

const APPLE_TOKEN = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE = 'https://appleid.apple.com/auth/revoke';
/** Vida del client_secret. Se firma por petición: cinco minutos sobran y no hay nada que rotar. */
const VIDA_SECRETO_S = 300;

export class ErrorApple extends Error {
  constructor(
    readonly paso: 'canje' | 'revocacion',
    readonly estado: number,
    /** El `error` del cuerpo de Apple (`invalid_grant`, `invalid_client`…) o null si no vino. */
    readonly codigo: string | null,
  ) {
    super(`apple ${paso} ${estado}${codigo === null ? '' : ` ${codigo}`}`);
    this.name = 'ErrorApple';
  }
}

/** Base64 para URL sin relleno (RFC 7515). Acepta texto o bytes. */
export function base64url(datos: string | Uint8Array): string {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos;
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** El .p8 (PEM PKCS#8) como CryptoKey para firmar ES256. */
async function importarClave(pem: string): Promise<CryptoKey> {
  const cuerpo = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binario = atob(cuerpo);
  const der = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) der[i] = binario.charCodeAt(i);
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * El client_secret: JWT ES256 con los claims de Apple, válido `VIDA_SECRETO_S` segundos desde `ahora`.
 *
 * WebCrypto firma ECDSA en formato crudo r‖s (IEEE P1363), que es exactamente lo que JWS exige para
 * ES256. Sin librería: no hay nada que una librería hiciera aquí que no sean estas doce líneas.
 */
export async function clientSecret(config: ConfigApple, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  const cabecera = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: ahora,
      exp: ahora + VIDA_SECRETO_S,
      aud: 'https://appleid.apple.com',
      sub: config.clientId,
    }),
  );
  const clave = await importarClave(config.clavePem);
  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    clave,
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  return `${cabecera}.${cuerpo}.${base64url(new Uint8Array(firma))}`;
}

/** El `error` del cuerpo JSON de Apple, si lo hay. Apple responde JSON en los 400. */
async function codigoDeError(respuesta: Response): Promise<string | null> {
  try {
    const json = (await respuesta.json()) as { error?: unknown };
    return typeof json.error === 'string' ? json.error : null;
  } catch {
    return null;
  }
}

async function formulario(url: string, campos: Record<string, string>, f: typeof fetch): Promise<Response> {
  return f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos).toString(),
  });
}

/** Canjea el authorization code del flujo nativo por el refresh token de Apple. */
export async function canjearCodigo(
  config: ConfigApple,
  secreto: string,
  codigo: string,
  f: typeof fetch = fetch,
): Promise<string> {
  const respuesta = await formulario(
    APPLE_TOKEN,
    { client_id: config.clientId, client_secret: secreto, code: codigo, grant_type: 'authorization_code' },
    f,
  );
  if (!respuesta.ok) throw new ErrorApple('canje', respuesta.status, await codigoDeError(respuesta));
  const json = (await respuesta.json()) as { refresh_token?: unknown };
  if (typeof json.refresh_token !== 'string' || json.refresh_token.length === 0) {
    throw new ErrorApple('canje', respuesta.status, 'sin_refresh_token');
  }
  return json.refresh_token;
}

/** Revoca el refresh token, y con él la autorización del usuario para esta app. */
export async function revocar(
  config: ConfigApple,
  secreto: string,
  refreshToken: string,
  f: typeof fetch = fetch,
): Promise<void> {
  const respuesta = await formulario(
    APPLE_REVOKE,
    { client_id: config.clientId, client_secret: secreto, token: refreshToken, token_type_hint: 'refresh_token' },
    f,
  );
  if (!respuesta.ok) throw new ErrorApple('revocacion', respuesta.status, await codigoDeError(respuesta));
}

/** Los tres pasos seguidos: firmar, canjear, revocar. Lo que llama la Edge Function. */
export async function revocarSignInWithApple(config: ConfigApple, codigo: string, f: typeof fetch = fetch): Promise<void> {
  const secreto = await clientSecret(config);
  const refresh = await canjearCodigo(config, secreto, codigo, f);
  await revocar(config, secreto, refresh, f);
}
