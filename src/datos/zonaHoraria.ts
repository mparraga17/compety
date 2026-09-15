import { getCalendars } from 'expo-localization';

import { CLAVES } from './almacen';
import { almacenNativo } from './almacenNativo';
import { HAY_SERVIDOR, supabase } from './supabase';

/**
 * La zona horaria del teléfono, declarada al servidor.
 *
 * ⭐ Es la pieza que hace que la liga tenga en cuenta el huso de cada persona (decisión de
 * producto, 15 sep 2026). El servidor calcula "hoy" y "esta semana" con la zona de cada perfil
 * (`hoy_de` en la migración 13) en vez de fiarse de la fecha que mande el teléfono: cerrar tus
 * periodos, tu clasificación y tu palmarés van con TU hora, y la jornada de una división con la
 * de SU ciudad. Sin esto el servidor no sabía dónde vive nadie.
 *
 * Se manda al arrancar, y solo si cambió desde la última vez (viajar, cambiar el ajuste del
 * sistema): una escritura por cambio, no una por arranque. La última enviada se recuerda en el
 * almacén; si el envío falla, no se recuerda y se reintenta en el siguiente arranque.
 */

/**
 * Formato IANA: `Area/Lugar` con un tercer tramo opcional (`Europe/Madrid`,
 * `America/Argentina/Buenos_Aires`, `Etc/GMT+1`), o `UTC`. Sin barra no vale: las abreviaturas
 * sueltas (`CET`, `GMT+1`) las interpreta Postgres a su manera y no son lo que el sistema quiere
 * decir.
 */
const FORMATO_IANA = /^[A-Za-z_]+\/[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)?$|^UTC$/;

/**
 * Zona horaria IANA del dispositivo, o null si no se puede saber.
 *
 * `getCalendars` la da en iOS y Android; en web puede ser null, y entonces se prueba con `Intl`.
 * Un valor con formato raro (`GMT+1` en algún Android) se descarta: el servidor lo rechazaría y
 * es mejor no declarar nada que declarar algo que no es una zona.
 */
export function zonaHorariaDelDispositivo(): string | null {
  let zona: string | null | undefined = getCalendars()[0]?.timeZone;
  if (!zona) {
    try {
      zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      zona = null;
    }
  }
  return typeof zona === 'string' && FORMATO_IANA.test(zona) ? zona : null;
}

/**
 * Declara la zona del teléfono si cambió desde la última declarada. Devuelve la zona que quedó
 * declarada, o null si no se pudo (sin red, sin zona, sin servidor).
 *
 * ⚠️ Los fallos NO se tragan aquí: quien llama decide. En el arranque se ignoran (la app funciona
 * igual con la zona anterior), pero un test o un diagnóstico quieren saber que falló.
 */
export async function declararZonaHoraria(): Promise<string | null> {
  if (!HAY_SERVIDOR) return null;
  const zona = zonaHorariaDelDispositivo();
  if (zona === null) return null;

  const almacen = almacenNativo();
  if ((await almacen.leer(CLAVES.zonaHoraria)) === zona) return zona;

  const { error } = await supabase.rpc('elegir_zona_horaria', { p_zona: zona });
  if (error) throw error;

  await almacen.guardar(CLAVES.zonaHoraria, zona).catch(() => undefined);
  return zona;
}

/** Al cerrar sesión: la siguiente cuenta en este teléfono tiene que declarar la suya. */
export async function olvidaZonaHorariaDeclarada(): Promise<void> {
  await almacenNativo().borrar(CLAVES.zonaHoraria);
}
