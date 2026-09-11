/**
 * Envio de avisos push. Se dispara con un Database Webhook al insertar en `avisos`.
 *
 * Patron tomado de Dizkarte, revisado con el MCP de GitHub. Cuatro cosas que importan:
 *   1. El aviso se escribe primero en la tabla y luego se envia, asi queda registrado aunque
 *      el push falle.
 *   2. Se guarda el resultado como enviado, suprimido o fallido, para depurar sin adivinar.
 *   3. ⭐ FALLA CERRADO: si el push no esta configurado devuelve 200 sin enviar, asi el webhook
 *      no se reintenta en bucle. Es el detalle que evita el desastre silencioso.
 *   4. Exige un secreto compartido en la cabecera, asi que solo el webhook puede invocarla.
 *
 * ⚠️ Corre en Deno, asi que NO se puede importar `expo-server-sdk-node`. Se usa la API HTTP de
 * Expo directamente. La contrapartida es que hay que gestionar los recibos a mano, y hay que
 * hacerlo: Apple y Google pueden bloquear apps que sigan enviando a dispositivos que
 * desinstalaron. De eso se encarga `limpiar-tokens`.
 *
 * ⛔ REGLA DURA DEL MENSAJE. Apple no permite revelar informacion de HealthKit a terceros sin
 * permiso expreso. Aqui solo entran puntuacion y tono, que son datos derivados que la persona
 * consiente al entrar en una liga. Si alguien mete pulsos, zonas o minutos en el texto, la app
 * se queda fuera de la App Store.
 */

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/**
 * Dos familias (migración 08): los de LIGA (`sesion`, `liderato`) van a los miembros de la liga y
 * llevan puntos y tono; los PERSONALES (`amistad`, `amistad_aceptada`, `reaccion`, `comentario`)
 * van a una sola persona y llevan, si acaso, un texto corto (el emoji o el arranque del
 * comentario). Quién recibe cada uno lo decide `destinatarios_de` en la base de datos.
 */
type Aviso = {
  id: string;
  liga: string | null;
  autor: string;
  clase: 'sesion' | 'liderato' | 'amistad' | 'amistad_aceptada' | 'reaccion' | 'comentario';
  puntos: number | null;
  tono: 'suave' | 'normal' | 'fuerte' | null;
  destinatario?: string | null;
  entreno?: string | null;
  texto?: string | null;
};

type Payload = { type: string; record: Aviso };

function cabeceras() {
  return { 'Content-Type': 'application/json' };
}

async function sql(consulta: string, parametros: unknown[] = []) {
  const url = Deno.env.get('SUPABASE_URL');
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !clave) throw new Error('sin credenciales de servicio');

  const respuesta = await fetch(`${url}/rest/v1/rpc/${consulta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: clave,
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify(parametros[0] ?? {}),
  });
  if (!respuesta.ok) throw new Error(await respuesta.text());
  return respuesta.json();
}

async function marcar(id: string, estado: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  await fetch(`${url}/rest/v1/avisos?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: clave ?? '',
      Authorization: `Bearer ${clave ?? ''}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ estado }),
  });
}

/**
 * Texto del aviso.
 *
 * El nombre no viaja en el aviso desde la base: se resuelve aqui con el perfil del autor, y
 * solo se usa el nombre visible que esa persona eligio.
 *
 * ⚠️ El tono sale de comparar con la base PROPIA de quien entrena, nunca con una escala
 * absoluta. Comparar valores absolutos entre marcas de pulsera daria una precision que no
 * existe, y encima expondria datos de salud.
 */
function redactar(nombre: string, aviso: Aviso): { title: string; body: string } {
  switch (aviso.clase) {
    case 'liderato':
      return {
        title: 'Cambio de liderato',
        body: `${nombre} se pone primero con ${aviso.puntos} puntos.`,
      };
    case 'amistad':
      return {
        title: 'Petición de amistad',
        body: `${nombre} quiere ser tu amigo en Compety.`,
      };
    case 'amistad_aceptada':
      return {
        title: nombre,
        body: 'Ha aceptado tu petición de amistad. Ya os veis en Competi.',
      };
    case 'reaccion':
      return {
        title: nombre,
        body: `Ha reaccionado ${aviso.texto ?? ''} a tu entreno.`.replace('  ', ' '),
      };
    case 'comentario':
      return {
        title: nombre,
        body: aviso.texto ? `Ha comentado tu entreno: «${aviso.texto}»` : 'Ha comentado tu entreno.',
      };
    default:
      return {
        title: nombre,
        body: `Ha sumado ${aviso.puntos} puntos. Una de sus sesiones más fuertes.`,
      };
  }
}

/** Texto genérico cuando el perfil no tiene nombre: distinto según de dónde venga el aviso. */
function sinNombre(aviso: Aviso): string {
  return aviso.destinatario ? 'Alguien' : 'Alguien de tu liga';
}

/** Trocea los envios. La API de Expo acepta hasta 100 mensajes por peticion. */
function trocea<T>(xs: readonly T[], tamano = 100): T[][] {
  const trozos: T[][] = [];
  for (let i = 0; i < xs.length; i += tamano) trozos.push(xs.slice(i, i + tamano));
  return trozos;
}

/** Un token de Expo tiene forma conocida. Filtrarlo antes ahorra errores del servidor. */
function tokenValido(t: unknown): t is string {
  return typeof t === 'string' && /^ExponentPushToken\[[^\]]+\]$/.test(t);
}

Deno.serve(async (peticion) => {
  // Solo el webhook. Sin esto cualquiera podria disparar avisos.
  const esperado = Deno.env.get('WEBHOOK_SECRETO');
  if (!esperado || peticion.headers.get('x-webhook-secreto') !== esperado) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), {
      status: 401,
      headers: cabeceras(),
    });
  }

  let aviso: Aviso;
  try {
    const cuerpo = (await peticion.json()) as Payload;
    aviso = cuerpo.record;
    if (!aviso?.id) throw new Error('sin registro');
  } catch (e) {
    // Falla cerrado: 200 para que el webhook no reintente en bucle con un cuerpo malo.
    return new Response(JSON.stringify({ saltado: String(e) }), {
      status: 200,
      headers: cabeceras(),
    });
  }

  try {
    const destinos = (await sql('destinatarios_de', [{ p_aviso: aviso.id }])) as {
      push_token: string;
    }[];
    const tokens = destinos.map((d) => d.push_token).filter(tokenValido);

    if (tokens.length === 0) {
      await marcar(aviso.id, 'suprimido');
      return new Response(JSON.stringify({ estado: 'suprimido', motivo: 'sin destinatarios' }), {
        status: 200,
        headers: cabeceras(),
      });
    }

    const perfil = (await sql('nombre_de', [{ p_usuario: aviso.autor }])) as string | null;
    const { title, body } = redactar(perfil ?? sinNombre(aviso), aviso);

    const recibos: unknown[] = [];
    for (const trozo of trocea(tokens)) {
      const respuesta = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(
          trozo.map((to) => ({
            to,
            title,
            body,
            sound: null,
            channelId: 'ligas',
            // Para abrir lo correcto al tocar el aviso: la liga, la bandeja de amigos o el
            // feed. Sin datos de salud.
            data: {
              clase: aviso.clase,
              liga: aviso.liga ?? undefined,
              entreno: aviso.entreno ?? undefined,
            },
          })),
        ),
      });
      recibos.push(await respuesta.json());
    }

    await marcar(aviso.id, 'enviado');
    return new Response(JSON.stringify({ estado: 'enviado', destinos: tokens.length, recibos }), {
      status: 200,
      headers: cabeceras(),
    });
  } catch (e) {
    await marcar(aviso.id, 'fallido');
    // 200 igualmente: el estado queda anotado y no se reintenta en bucle.
    return new Response(JSON.stringify({ estado: 'fallido', error: String(e) }), {
      status: 200,
      headers: cabeceras(),
    });
  }
});
