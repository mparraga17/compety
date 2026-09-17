import { base64url, canjearCodigo, clientSecret, ErrorApple, revocar, type ConfigApple } from './apple';

/**
 * La parte pura del borrado de cuenta: hablar con Apple. Corre en Node con la misma WebCrypto que
 * usa Deno en la Edge Function, así que lo que pasa aquí es lo que pasa allí.
 *
 * Verificado contra las fuentes primarias (16 sep): "Creating a client secret" (claims y firma
 * ES256) y "Token revocation" (parámetros del formulario).
 */

/** Una clave P-256 de usar y tirar, exportada en el mismo formato que el .p8 de Apple (PKCS#8 PEM). */
async function claveDePrueba() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
  const b64 = btoa(String.fromCharCode(...der));
  const lineas = b64.match(/.{1,64}/g) ?? [];
  const pem = `-----BEGIN PRIVATE KEY-----\n${lineas.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return { pem, publica: par.publicKey };
}

// Solo APIs web (atob), como el módulo: el tsconfig de la app no trae los tipos de Node.
const desdeBase64url = (segmento: string) => atob(segmento.replace(/-/g, '+').replace(/_/g, '/'));
const decodifica = (segmento: string) => JSON.parse(desdeBase64url(segmento));

describe('base64url', () => {
  test('sin relleno y con el alfabeto de URL, como exige JWS', () => {
    // 0xfb 0xff → "+/8=" en base64 normal → "-_8" en base64url.
    expect(base64url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(base64url('{"alg":"ES256"}')).toBe('eyJhbGciOiJFUzI1NiJ9');
  });
});

describe('client_secret de Apple', () => {
  const config = (pem: string): ConfigApple => ({
    teamId: '42FRM9XP5Q',
    clientId: 'com.pizcodeploy.compety',
    keyId: 'Q235LPZSDD',
    clavePem: pem,
  });

  test('es un JWT ES256 con los cinco claims que pide Apple y el kid de la clave', async () => {
    const { pem } = await claveDePrueba();
    const ahora = 1_800_000_000;
    const jwt = await clientSecret(config(pem), ahora);
    const partes = jwt.split('.');
    expect(partes).toHaveLength(3);
    expect(decodifica(partes[0])).toEqual({ alg: 'ES256', kid: 'Q235LPZSDD' });
    expect(decodifica(partes[1])).toEqual({
      iss: '42FRM9XP5Q',
      iat: ahora,
      exp: ahora + 300,
      aud: 'https://appleid.apple.com',
      sub: 'com.pizcodeploy.compety',
    });
  });

  test('la firma verifica con la clave pública y deja de verificar si se toca el payload', async () => {
    const { pem, publica } = await claveDePrueba();
    const jwt = await clientSecret(config(pem));
    const [cabecera, cuerpo, firma] = jwt.split('.');
    const bytesFirma = Uint8Array.from(desdeBase64url(firma), (c) => c.charCodeAt(0));
    const verifica = (datos: string) =>
      crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publica,
        bytesFirma,
        new TextEncoder().encode(datos),
      );
    expect(await verifica(`${cabecera}.${cuerpo}`)).toBe(true);
    expect(await verifica(`${cabecera}.${cuerpo}x`)).toBe(false);
  });

  test('caduca a los cinco minutos: se firma por petición, no hace falta rotar nada', async () => {
    const { pem } = await claveDePrueba();
    const jwt = await clientSecret(config(pem), 1000);
    expect(decodifica(jwt.split('.')[1]).exp - 1000).toBe(300);
  });
});

describe('canjear el authorization code', () => {
  const config: ConfigApple = { teamId: 'T', clientId: 'com.app', keyId: 'K', clavePem: '' };

  test('manda el formulario que pide Apple y devuelve el refresh_token', async () => {
    let peticion: { url: string; cuerpo: string; tipo: string | null } | null = null;
    const fetchFalso = async (url: string, init: RequestInit) => {
      peticion = {
        url,
        cuerpo: String(init.body),
        tipo: new Headers(init.headers).get('content-type'),
      };
      return new Response(JSON.stringify({ refresh_token: 'rt-123', access_token: 'at', id_token: 'id' }), { status: 200 });
    };
    const refresh = await canjearCodigo(config, 'secreto.jwt', 'codigo-abc', fetchFalso as typeof fetch);
    expect(refresh).toBe('rt-123');
    expect(peticion!.url).toBe('https://appleid.apple.com/auth/token');
    expect(peticion!.tipo).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(peticion!.cuerpo).get('client_id')).toBe('com.app');
    expect(new URLSearchParams(peticion!.cuerpo).get('client_secret')).toBe('secreto.jwt');
    expect(new URLSearchParams(peticion!.cuerpo).get('code')).toBe('codigo-abc');
    expect(new URLSearchParams(peticion!.cuerpo).get('grant_type')).toBe('authorization_code');
  });

  test('un código gastado o falso es invalid_grant, y se distingue de un secreto mal configurado', async () => {
    const fetchFalso = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    await expect(canjearCodigo(config, 's', 'c', fetchFalso as typeof fetch)).rejects.toMatchObject({
      paso: 'canje',
      estado: 400,
      codigo: 'invalid_grant',
    });
    const fetchClienteMal = async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 400 });
    await expect(canjearCodigo(config, 's', 'c', fetchClienteMal as typeof fetch)).rejects.toMatchObject({
      codigo: 'invalid_client',
    });
  });

  test('una respuesta sin refresh_token es un error, no un borrado a medias', async () => {
    const fetchFalso = async () => new Response(JSON.stringify({ access_token: 'solo' }), { status: 200 });
    await expect(canjearCodigo(config, 's', 'c', fetchFalso as typeof fetch)).rejects.toBeInstanceOf(ErrorApple);
  });
});

describe('revocar el refresh token', () => {
  const config: ConfigApple = { teamId: 'T', clientId: 'com.app', keyId: 'K', clavePem: '' };

  test('manda token y token_type_hint=refresh_token al endpoint de revocación', async () => {
    let cuerpo = '';
    let url = '';
    const fetchFalso = async (u: string, init: RequestInit) => {
      url = u;
      cuerpo = String(init.body);
      return new Response(null, { status: 200 });
    };
    await revocar(config, 'secreto.jwt', 'rt-123', fetchFalso as typeof fetch);
    expect(url).toBe('https://appleid.apple.com/auth/revoke');
    const f = new URLSearchParams(cuerpo);
    expect(f.get('token')).toBe('rt-123');
    expect(f.get('token_type_hint')).toBe('refresh_token');
    expect(f.get('client_id')).toBe('com.app');
    expect(f.get('client_secret')).toBe('secreto.jwt');
  });

  test('un 400 de Apple se propaga con su código para que el borrado NO siga', async () => {
    const fetchFalso = async () => new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 });
    await expect(revocar(config, 's', 'rt', fetchFalso as typeof fetch)).rejects.toMatchObject({
      paso: 'revocacion',
      codigo: 'invalid_request',
    });
  });
});
