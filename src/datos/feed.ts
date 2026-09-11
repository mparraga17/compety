import { HAY_SERVIDOR, supabase } from './supabase';
import { tonoDe, type Tono } from './ligas';
import { zDe } from '../motor/base';
import type { Resultado } from '../motor/sesiones';
import { conValores, type Textos } from '../i18n/textos';

/**
 * El feed de amigos: los entrenos de tu gente, con reacciones y comentarios.
 *
 * ⚠️ Qué viaja por entreno, y nada más: el TIPO de deporte (RUNNING, BARRE…), los puntos, el tono
 * respecto a la propia base y el momento en que terminó, redondeado al minuto. Ni duración, ni
 * pulsos, ni zonas. El tipo es una etiqueta de actividad, no una medida de salud, y es lo que
 * convierte una fila en algo que se entiende ("Barre · sesión fuerte"). Está declarado en la
 * política de privacidad.
 *
 * Quién lo ve lo decide el servidor (`ve_entrenos_de`): amigos aceptados y compañeros de liga
 * privada. Las ligas de zona quedan fuera.
 */

/** Reacciones posibles. Mismo repertorio que el CHECK de la tabla `reacciones`. */
export const EMOJIS = ['🔥', '💪', '👏', '❤️'] as const;
export type Emoji = (typeof EMOJIS)[number];

export type Entreno = {
  id: string;
  usuario: string;
  nombre: string;
  /** Tipo del motor (RUNNING, BARRE…) o null si HealthKit no lo trajo. */
  deporte: string | null;
  puntos: number;
  tono: Tono;
  /** Cuándo terminó, en milisegundos. */
  fin: number;
  /** Cuántas reacciones de cada emoji. Solo aparecen los emojis con alguna. */
  reacciones: Partial<Record<Emoji, number>>;
  /** La tuya, si has reaccionado. */
  miReaccion: Emoji | null;
  comentarios: number;
};

export type Comentario = {
  id: string;
  usuario: string;
  nombre: string;
  texto: string;
  creado: number;
};

export type Reaccion = { usuario: string; nombre: string; emoji: Emoji };

/** Lo que se manda al publicar. Es el contrato de `publicar_entrenos`. */
export type EntrenoParaPublicar = {
  id: string;
  deporte: string | null;
  puntos: number;
  tono: Tono;
  /** ISO 8601, al minuto. */
  fin: string;
};

/** Tope del lote que acepta el servidor. */
export const TOPE_LOTE = 60;

/**
 * Convierte el resultado del motor en el lote a publicar. Función pura, para poder probarla.
 *
 * El tono se calcula igual que el aviso de sesión fuerte: la carga de la sesión contra la base
 * propia. Los segundos se tiran: al minuto basta para ordenar el feed y no cuenta nada que no
 * cuente ya la hora.
 */
export function entrenosParaPublicar(resultado: Resultado): EntrenoParaPublicar[] {
  return [...resultado.sesiones]
    .sort((a, b) => b.inicio - a.inicio)
    .slice(0, TOPE_LOTE)
    .map((s) => {
      const fin = new Date(s.fin);
      fin.setSeconds(0, 0);
      return {
        id: s.id,
        deporte: s.tipo ?? null,
        puntos: Math.max(0, Math.min(1000, Math.round(s.puntos))),
        tono: tonoDe(zDe(s.carga, resultado.base)),
        fin: fin.toISOString(),
      };
    });
}

/**
 * "hace 5 min", "hace 3 h", "ayer", "hace 4 días". Función pura con el ahora inyectado.
 *
 * Relativo y no absoluto porque el feed se lee como conversación: lo que importa es si fue hoy
 * o la semana pasada, no a qué hora exacta.
 */
export function tiempoRelativo(fin: number, ahora: number, t: Textos): string {
  const minutos = Math.max(0, Math.round((ahora - fin) / 60_000));
  if (minutos < 1) return t.feedAhora;
  if (minutos < 60) return conValores(t.feedHaceMin, { n: minutos });
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return conValores(t.feedHaceHoras, { n: horas });
  const dias = Math.floor(horas / 24);
  if (dias === 1) return t.feedAyer;
  return conValores(t.feedHaceDias, { n: dias });
}

/**
 * Cómo queda un entreno tras tocar un emoji, ANTES de que responda el servidor (optimista).
 *
 * Tocar el tuyo lo quita; tocar otro lo cambia; tocar sin tener ninguno lo pone. Los contadores
 * se mueven en consecuencia y nunca bajan de cero. Función pura, probada.
 */
export function alternaReaccion(e: Entreno, emoji: Emoji): Entreno {
  const reacciones: Partial<Record<Emoji, number>> = { ...e.reacciones };
  const resta = (k: Emoji) => {
    const n = (reacciones[k] ?? 0) - 1;
    if (n <= 0) delete reacciones[k];
    else reacciones[k] = n;
  };
  const suma = (k: Emoji) => {
    reacciones[k] = (reacciones[k] ?? 0) + 1;
  };

  if (e.miReaccion === emoji) {
    resta(emoji);
    return { ...e, reacciones, miReaccion: null };
  }
  if (e.miReaccion !== null) resta(e.miReaccion);
  suma(emoji);
  return { ...e, reacciones, miReaccion: emoji };
}

function esEmoji(x: unknown): x is Emoji {
  return typeof x === 'string' && (EMOJIS as readonly string[]).includes(x);
}

function sinServidor(): never {
  throw new Error('sin-servidor');
}

/** Publica en lote. Idempotente por huella en el servidor. Devuelve cuántos aceptó. */
export async function publicarEntrenos(lote: readonly EntrenoParaPublicar[]): Promise<number> {
  if (!HAY_SERVIDOR || lote.length === 0) return 0;

  const { data, error } = await supabase.rpc('publicar_entrenos', {
    p_entrenos: lote.slice(0, TOPE_LOTE),
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * El feed, del más reciente al más antiguo. `antes` es el `fin` del último recibido, para
 * paginar; sin él, la primera página.
 */
export async function feed(limite = 30, antes: number | null = null): Promise<Entreno[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('feed', {
    p_limite: limite,
    p_antes: antes === null ? null : new Date(antes).toISOString(),
  });
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    usuario: string;
    nombre: string;
    deporte: string | null;
    puntos: number;
    tono: Tono;
    fin: string;
    reacciones: Record<string, number> | null;
    mi_reaccion: string | null;
    comentarios: number;
  }[]).map((f) => {
    const reacciones: Partial<Record<Emoji, number>> = {};
    for (const [k, n] of Object.entries(f.reacciones ?? {})) {
      if (esEmoji(k) && n > 0) reacciones[k] = n;
    }
    return {
      id: f.id,
      usuario: f.usuario,
      nombre: f.nombre,
      deporte: f.deporte,
      puntos: f.puntos,
      tono: f.tono,
      fin: new Date(f.fin).getTime(),
      reacciones,
      miReaccion: esEmoji(f.mi_reaccion) ? f.mi_reaccion : null,
      comentarios: f.comentarios,
    };
  });
}

/** Pone, cambia o quita (`null`) tu reacción. El servidor avisa al dueño la primera vez. */
export async function reaccionar(entreno: string, emoji: Emoji | null): Promise<void> {
  if (!HAY_SERVIDOR) sinServidor();
  const { error } = await supabase.rpc('reaccionar', { p_entreno: entreno, p_emoji: emoji });
  if (error) throw error;
}

export async function comentar(entreno: string, texto: string): Promise<string> {
  if (!HAY_SERVIDOR) sinServidor();
  const { data, error } = await supabase.rpc('comentar', {
    p_entreno: entreno,
    p_texto: texto.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function comentariosDe(entreno: string): Promise<Comentario[]> {
  if (!HAY_SERVIDOR) return [];
  const { data, error } = await supabase.rpc('comentarios_de', { p_entreno: entreno });
  if (error) throw error;
  return ((data ?? []) as { id: string; usuario: string; nombre: string; texto: string; creado: string }[]).map(
    (c) => ({ ...c, creado: new Date(c.creado).getTime() }),
  );
}

export async function reaccionesDe(entreno: string): Promise<Reaccion[]> {
  if (!HAY_SERVIDOR) return [];
  const { data, error } = await supabase.rpc('reacciones_de', { p_entreno: entreno });
  if (error) throw error;
  return ((data ?? []) as { usuario: string; nombre: string; emoji: string }[])
    .filter((r): r is { usuario: string; nombre: string; emoji: Emoji } => esEmoji(r.emoji))
    .map((r) => ({ usuario: r.usuario, nombre: r.nombre, emoji: r.emoji }));
}

/** Borra un comentario tuyo, o uno ajeno bajo TU entreno. Lo decide la RLS. */
export async function borrarComentario(id: string): Promise<void> {
  if (!HAY_SERVIDOR) return;
  const { error } = await supabase.from('comentarios').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Quita un entreno tuyo del feed. Se lleva sus reacciones y comentarios.
 *
 * ⚠️ No es un borrado: el servidor lo marca oculto. Si se borrara la fila, la siguiente
 * sincronización volvería a publicar la misma huella y el entreno reaparecería.
 */
export async function ocultarEntreno(id: string): Promise<void> {
  if (!HAY_SERVIDOR) return;
  const { error } = await supabase.rpc('ocultar_entreno', { p_entreno: id });
  if (error) throw error;
}
