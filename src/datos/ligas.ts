import { HAY_SERVIDOR, supabase } from './supabase';
import type { IdHorizonte } from '../motor/ranking';

/**
 * Ligas contra el servidor.
 *
 * ⚠️ Recordatorio de lo que viaja: puntos, numero de sesiones y un tono cualitativo. Nada mas.
 * Ni pulsos, ni zonas, ni minutos de esfuerzo. Si alguien anade un campo de salud aqui, esta
 * rompiendo la arquitectura y la guia 5.1.3 de Apple a la vez.
 */

export type LigaRemota = {
  id: string;
  nombre: string;
  /** id de liga del motor, o null en la general. */
  deporte: string | null;
  codigo: string;
  miembros: number;
};

export type Puesto = {
  usuario: string;
  nombre: string;
  puntos: number;
  sesiones: number;
  tono: Tono | null;
};

/** Comparado con la base PROPIA de esa persona, nunca en absoluto. */
export type Tono = 'suave' | 'normal' | 'fuerte';

/** Etiqueta cualitativa a partir del z respecto a la propia media. */
export function tonoDe(z: number): Tono {
  if (z >= 1) return 'fuerte';
  if (z <= -1) return 'suave';
  return 'normal';
}

/** Dia de cierre del periodo, en hora local. */
export function periodoDe(fecha: Date = new Date()): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

function sinServidor(): never {
  throw new Error('sin-servidor');
}

export async function misLigas(): Promise<readonly LigaRemota[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase
    .from('ligas')
    .select('id, nombre, deporte, codigo, miembros(count)');
  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id as string,
    nombre: l.nombre as string,
    deporte: (l.deporte as string | null) ?? null,
    codigo: l.codigo as string,
    miembros: (l.miembros as { count: number }[] | null)?.[0]?.count ?? 1,
  }));
}

export async function crearLiga(
  nombre: string,
  deporte: string | null = null,
): Promise<{ id: string; codigo: string }> {
  if (!HAY_SERVIDOR) sinServidor();

  const { data, error } = await supabase
    .rpc('crear_liga', { p_nombre: nombre, p_deporte: deporte })
    .single();
  if (error) throw error;
  return data as { id: string; codigo: string };
}

/** Entrar con el codigo de seis caracteres que te pasan. */
export async function entrarEnLiga(codigo: string): Promise<string> {
  if (!HAY_SERVIDOR) sinServidor();

  const { data, error } = await supabase.rpc('entrar_en_liga', {
    p_codigo: codigo.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string;
}

export async function clasificacion(
  liga: string,
  horizonte: IdHorizonte,
  periodo = periodoDe(),
): Promise<readonly Puesto[]> {
  if (!HAY_SERVIDOR) return [];

  const { data, error } = await supabase.rpc('clasificacion', {
    p_liga: liga,
    p_horizonte: horizonte,
    p_periodo: periodo,
  });
  if (error) throw error;
  return (data ?? []) as Puesto[];
}

/**
 * Sube tu puntuacion de una liga y una ventana.
 *
 * Idempotente por la clave primaria (liga, usuario, horizonte, periodo), asi que el segundo
 * plano puede llamarlo varias veces con los mismos datos sin duplicar nada.
 */
export async function subirPuntuacion(entrada: {
  liga: string;
  horizonte: IdHorizonte;
  puntos: number;
  sesiones: number;
  tono: Tono;
  periodo?: string;
}): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const sesion = await supabase.auth.getSession();
  const usuario = sesion.data.session?.user.id;
  if (usuario === undefined) return;

  const { error } = await supabase.from('puntuaciones').upsert(
    {
      liga: entrada.liga,
      usuario,
      horizonte: entrada.horizonte,
      periodo: entrada.periodo ?? periodoDe(),
      puntos: entrada.puntos,
      sesiones: entrada.sesiones,
      tono: entrada.tono,
      actualizado: new Date().toISOString(),
    },
    { onConflict: 'liga,usuario,horizonte,periodo' },
  );
  // Una semana ya cerrada no se reescribe, y eso no es un fallo: es la garantia de que quien
  // gano el lunes sigue habiendo ganado el jueves. El disparador del servidor lo rechaza.
  if (error !== null && !/ya esta cerrada/.test(error.message)) throw error;
}

/**
 * Cierra los periodos que ya pasaron.
 *
 * ⭐ Congelar al cerrar es una decision con motivo. La base personal se recalcula al llegar datos
 * nuevos, asi que sin esto una semana terminada podria cambiar de puntuacion y quien gano podria
 * dejar de haber ganado. La teoria de la autodeterminacion dice que perder la competencia
 * percibida predice abandono, y quitarle a alguien una victoria ya conseguida es la forma mas
 * directa de hacerlo.
 *
 * El cierre va por hora LOCAL de cada persona, que es la que esa persona vivio.
 */
export async function cerrarPeriodos(hoy = periodoDe()): Promise<number> {
  if (!HAY_SERVIDOR) return 0;
  const { data, error } = await supabase.rpc('cerrar_periodos', { p_hoy: hoy });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Anota un aviso para que el servidor lo envie.
 *
 * ⛔ Solo se pasa puntuacion y tono. La restriccion de Apple es literal: no se puede revelar
 * informacion obtenida de HealthKit a un tercero sin permiso expreso. El tono sale de comparar
 * con la base propia de quien entrena, asi que no expone ningun valor de salud.
 *
 * La huella evita avisar dos veces de la misma sesion si el segundo plano se repite.
 */
export async function anotarAviso(entrada: {
  liga: string;
  clase: 'sesion' | 'liderato';
  puntos: number;
  tono: Tono;
  huella: string;
}): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const { error } = await supabase.rpc('anotar_aviso', {
    p_liga: entrada.liga,
    p_clase: entrada.clase,
    p_puntos: entrada.puntos,
    p_tono: entrada.tono,
    p_huella: entrada.huella,
  });
  if (error) throw error;
}

/** Apagar o encender los avisos de una liga concreta. Requisito de autonomia. */
export async function cambiarAvisos(liga: string, avisos: boolean): Promise<void> {
  if (!HAY_SERVIDOR) return;

  const sesion = await supabase.auth.getSession();
  const usuario = sesion.data.session?.user.id;
  if (usuario === undefined) return;

  const { error } = await supabase
    .from('miembros')
    .update({ avisos })
    .eq('liga', liga)
    .eq('usuario', usuario);
  if (error) throw error;
}

/** Borrado de cuenta desde la app. Apple lo exige. */
export async function borrarCuenta(): Promise<void> {
  if (!HAY_SERVIDOR) return;
  const { error } = await supabase.rpc('borrar_mi_cuenta');
  if (error) throw error;
  await supabase.auth.signOut();
}
