import { ligaDe } from './ligas';
import type { Zonas } from './zonas';

/**
 * Objetivo de la Organización Mundial de la Salud.
 *
 * ⭐ Por qué es el protagonista de la pestaña Salud y no un dato más: es el único objetivo del
 * producto que NO nos hemos inventado. De 150 a 300 minutos semanales de intensidad moderada, o
 * de 75 a 150 de vigorosa, más dos días de fortalecimiento. Externo, verificable y con propósito
 * de salud, que es justo lo contrario de un score opaco.
 *
 * La OMS permite equiparar un minuto vigoroso a dos moderados, así que el número que se muestra
 * son minutos moderados equivalentes.
 */

/** Minutos moderados equivalentes por semana. Suelo del rango de la OMS. */
export const OBJETIVO_MINUTOS = 150;

/** Días de fortalecimiento por semana que pide la OMS. */
export const OBJETIVO_FUERZA = 2;

/** Un minuto vigoroso vale dos moderados. Es la equivalencia de la propia guía. */
export const FACTOR_VIGOROSA = 2;

/**
 * Lo mínimo que la OMS necesita de una sesión.
 *
 * ⚠️ `readonly` en los campos para que una `Sesion` del motor encaje sin cast: sus propiedades
 * vienen de un tipo con arrays readonly, y sin esto TypeScript rechaza la asignación.
 */
export type SesionParaOms = {
  readonly inicio: number;
  readonly tipo: string | null;
  readonly zonas: Zonas | null;
};

export type Oms = {
  moderada: number;
  vigorosa: number;
  /** Moderados equivalentes: moderada + vigorosa x 2. Es la cifra que se muestra. */
  equivalente: number;
  objetivo: number;
  /** Minutos que faltan. 0 cuando ya se cumple. */
  faltan: number;
  diasFuerza: number;
  objetivoFuerza: number;
  cumple: boolean;
  /** 0 a 100, acotado. Es lo que llena la barra. */
  progreso: number;
};

/** Fecha local `YYYY-MM-DD`, para contar días de fuerza sin duplicar. */
function diaLocal(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Minutos por intensidad y días de fuerza.
 *
 * ⚠️ Las zonas son cuatro, de suave a máxima. La OMS habla de moderada y vigorosa, así que se
 * mapean: la zona 2 es moderada, y las zonas 3 y 4 juntas son vigorosa. La zona 1 no cuenta,
 * porque por debajo del 50 % del máximo no es esfuerzo.
 *
 * ⚠️ Las sesiones SIN pulso no suman aquí, y es a propósito. En el ranking sí puntúan con su
 * descuento, porque expulsarlas castigaría a quien no lleva pulsera. Pero el objetivo de la OMS
 * está definido en minutos de una intensidad concreta, así que estimarlos sería inventar el dato
 * que el objetivo mide. Se declara en la interfaz.
 */
export function calculaOms(sesiones: readonly SesionParaOms[]): Oms {
  let moderada = 0;
  let vigorosa = 0;

  for (const s of sesiones) {
    if (s.zonas === null) continue;
    const [, mod, vig, max] = s.zonas.segundos;
    moderada += mod / 60;
    vigorosa += (vig + max) / 60;
  }

  // Fuerza y estudio cuentan como fortalecimiento. Barre y pilates son trabajo muscular, y la
  // guía habla de "actividades de fortalecimiento muscular", no de levantar peso.
  const diasFuerza = new Set(
    sesiones
      .filter((s) => {
        const liga = ligaDe(s.tipo);
        return liga === 'fuerza' || liga === 'estudio';
      })
      .map((s) => diaLocal(s.inicio)),
  ).size;

  const equivalente = Math.round(moderada + vigorosa * FACTOR_VIGOROSA);

  return {
    moderada: Math.round(moderada),
    vigorosa: Math.round(vigorosa),
    equivalente,
    objetivo: OBJETIVO_MINUTOS,
    faltan: Math.max(0, OBJETIVO_MINUTOS - equivalente),
    diasFuerza,
    objetivoFuerza: OBJETIVO_FUERZA,
    cumple: equivalente >= OBJETIVO_MINUTOS,
    progreso: Math.min(100, Math.round((equivalente / OBJETIVO_MINUTOS) * 100)),
  };
}
