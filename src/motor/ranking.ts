import { entraEnLiga, type IdLiga } from './ligas';
import { MINUTOS_MINIMOS } from './met';
import { lunesDe } from './semana';

/**
 * Ranking. Es la pieza que decide quien gana, y ha fallado tres veces por el mismo motivo.
 *
 * Historia, porque explica el diseno actual:
 *   1. Sumar TODAS las sesiones. Ganaba quien mas veces salia: 477 puntos frente a 257 del
 *      segundo, solo por acumular 21 paseos de 20 min.
 *   2. Sumar las 5 mejores. Mejor, pero cada sesion vale unos 50 puntos por construccion,
 *      porque la media personal siempre da 50. El total seguia midiendo numero de sesiones.
 *   3. ✅ MEDIA de las mejores mas un bonus acotado por constancia.
 *
 * ⛔ Descartado el filtro de intensidad minima, y se probo con datos reales: expulsaba el
 * 100 % de las sesiones de fuerza (intensidad 1,00) y el 67 % del golf. Habria castigado
 * justo a los deportes que la evidencia dice no castigar. El problema nunca fue la intensidad.
 *
 * ⭐⭐ POR QUE GANA LA SESION MAS LARGA, Y POR QUE ESTA BIEN (30 ago).
 *
 * Con las cuatro sesiones reales medidas en el iPhone, 260 min de bici dan 74 puntos y 60 min
 * de fuerza dan 52. Lo marque como posible fallo de diseno. Lo es al reves: la evidencia dice
 * que asi debe ser, y esto no es una decision de producto.
 *
 * Metaanalisis armonizado de 9 cohortes con acelerometro, 46.682 adultos, 9 anos de
 * seguimiento (Am J Prev Med 2024, https://pubmed.ncbi.nlm.nih.gov/39089430/):
 *
 *   mas VOLUMEN total          HR 0,62 (IC 0,58-0,67) y 0,50 (IC 0,42-0,60)
 *   mas INTENSIDAD a igual vol HR 0,94 (IC 0,85-1,04) y 0,88 (IC 0,79-0,98)
 *
 * Los intervalos no solapan. El volumen manda y la intensidad anade un beneficio pequeno
 * encima, que es exactamente lo que hace la formula: carga = intensidad x volumen comprimido.
 *
 * ⛔ De ahi que NO se toque el exponente 0,65 de compresion para "arreglar" esto. Esta
 * calibrado para que 4 h de golf equivalgan a 90 min de tenis, y la evidencia no pide mas.
 *
 * ⚠️ Limitaciones declaradas: son cohortes, asi que asociacion y no causa, y la edad media es
 * 64 anos, mayor que el nicho de la app. Sin texto completo en PMC, citado por abstract.
 */

/**
 * Techo del bonus por constancia. Pequeno a proposito.
 *
 * A igual volumen total, concentrar el ejercicio en 1 o 2 sesiones dio la MISMA mortalidad que
 * repartirlo: HR 1,08 (IC 0,97-1,20) en 350.978 adultos, replicado con acelerometro en dos
 * cohortes mas. https://pubmed.ncbi.nlm.nih.gov/35788615/
 *
 * ⇒ El bonus existe porque el riesgo de LESION si sube al concentrar todo en un dia, y porque
 * la OMS pide regularidad. Pero no puede ser grande, porque la mortalidad no distingue. Subirlo
 * seria premiar la frecuencia sin respaldo, que es el fallo original.
 */
export const BONUS_MAX = 15;

/** A partir de estas sesiones el bonus ya es maximo. Evita premiar el volumen. */
export const SESIONES_OBJETIVO = 3;

/** Sesiones que puntuan en una semana. Escala con la ventana, ver HORIZONTES. */
export const SESIONES_QUE_PUNTUAN = 5;

/** Lo minimo que el ranking necesita saber de una sesion. */
export type SesionPuntuada = {
  id: string;
  /** Momento de inicio en milisegundos. */
  inicio: number;
  tipo: string | null;
  minutos: number;
  puntos: number;
  carga: number;
  /** true cuando la carga se estimo sin pulso. Puntua igual, con su descuento ya aplicado. */
  sinPulso?: boolean;
};

export type Ranking = {
  /** La cifra que se muestra y con la que se compite. */
  total: number;
  /** Media de las sesiones que cuentan, antes del bonus. */
  media: number;
  bonus: number;
  /** Ids de las sesiones que entraron en el top. La interfaz las marca. */
  cuentan: readonly string[];
  tope: number;
  /** Sesiones validas del periodo. */
  validas: number;
  /** Validas que se quedaron fuera del top. */
  fuera: number;
};

export const RANKING_VACIO: Ranking = {
  total: 0,
  media: 0,
  bonus: 0,
  cuentan: [],
  tope: SESIONES_QUE_PUNTUAN,
  validas: 0,
  fuera: 0,
};

/** Duracion suficiente para tratarlo como sesion. Hay registros de golf de 0,2 min. */
export function esValida(s: SesionPuntuada): boolean {
  return s.minutos >= MINUTOS_MINIMOS && s.carga > 0;
}

/**
 * Puntuacion de un periodo.
 *
 * El puesto lo decide la CALIDAD del esfuerzo. La constancia aporta, pero no domina, que es
 * coherente con la OMS: pide regularidad, no acumular sesiones sueltas.
 */
export function rankea(
  sesiones: readonly SesionPuntuada[],
  { tope = SESIONES_QUE_PUNTUAN }: { tope?: number } = {},
): Ranking {
  const validas = sesiones.filter(esValida);
  if (validas.length === 0) return { ...RANKING_VACIO, tope };

  // Empate resuelto por carga y luego por fecha, para que el orden sea estable.
  const mejores = [...validas]
    .sort((a, b) => b.puntos - a.puntos || b.carga - a.carga || b.inicio - a.inicio)
    .slice(0, tope);

  const media = mejores.reduce((a, s) => a + s.puntos, 0) / mejores.length;
  const bonus = Math.round(Math.min(1, validas.length / SESIONES_OBJETIVO) * BONUS_MAX);

  return {
    total: Math.round(media) + bonus,
    media: +media.toFixed(1),
    bonus,
    cuentan: mejores.map((s) => s.id),
    tope,
    validas: validas.length,
    fuera: Math.max(0, validas.length - tope),
  };
}

/** Ranking de una liga concreta. La general acepta todos los deportes. */
export function rankeaLiga(
  sesiones: readonly SesionPuntuada[],
  liga: IdLiga,
  opciones: { tope?: number } = {},
): Ranking {
  return rankea(
    sesiones.filter((s) => entraEnLiga(s.tipo, liga)),
    opciones,
  );
}

/**
 * Ventanas temporales. Dos familias, y la diferencia importa.
 *
 * Las de calendario (semana, mes y ano en curso) arrancan en el corte, asi que el lunes por
 * la manana el ranking esta casi vacio. Las moviles de N dias estan siempre llenas y
 * comparan mejor. Se ofrecen las dos porque responden a preguntas distintas: quien va
 * ganando esta semana frente a quien esta mas en forma ultimamente.
 *
 * ⚠️ El tope escala con la ventana. Dejar 5 para un ano entero haria ganar a quien tuviera
 * cinco sesiones brutales en enero, asi que se mantiene la proporcion de unas 5 por semana.
 */
export type IdHorizonte = 'wtd' | 'd7' | 'mtd' | 'd30' | 'ytd';

export type Horizonte = {
  id: IdHorizonte;
  /** Clave de i18n. El texto visible se resuelve en la interfaz. */
  clave: string;
  tope: number;
  /** true en las de calendario, que arrancan en un corte fijo. */
  calendario: boolean;
};

export const HORIZONTES: readonly Horizonte[] = [
  { id: 'wtd', clave: 'horizonte.wtd', tope: 5, calendario: true },
  { id: 'd7', clave: 'horizonte.d7', tope: 5, calendario: false },
  { id: 'mtd', clave: 'horizonte.mtd', tope: 20, calendario: true },
  { id: 'd30', clave: 'horizonte.d30', tope: 20, calendario: false },
  { id: 'ytd', clave: 'horizonte.ytd', tope: 60, calendario: true },
];

export const HORIZONTE_POR_DEFECTO: IdHorizonte = 'd7';

/**
 * Momento en que empieza una ventana.
 *
 * ⚠️ La zona horaria es una decision de producto todavia abierta: cerrar la semana por hora
 * local de cada persona o por una referencia comun. Con un grupo en Espana da igual, con
 * alguien en Mexico no. Hasta que se decida se usa la hora local del dispositivo, que es lo
 * que espera quien mira su propia app.
 */
export function desdeDe(horizonte: Horizonte, ahora: Date = new Date()): number {
  const dia = 86_400_000;

  switch (horizonte.id) {
    case 'wtd':
      // Lunes como primer dia, que es la convencion en Espana. Por calendario y no restando
      // horas: ver `semana.ts` para el bug de cambio de hora que motiva la regla.
      return lunesDe(ahora.getTime());
    case 'mtd':
      return new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    case 'ytd':
      return new Date(ahora.getFullYear(), 0, 1).getTime();
    case 'd7':
      return ahora.getTime() - 7 * dia;
    case 'd30':
      return ahora.getTime() - 30 * dia;
  }
}

export function enVentana(
  sesiones: readonly SesionPuntuada[],
  horizonte: Horizonte,
  ahora: Date = new Date(),
): readonly SesionPuntuada[] {
  const desde = desdeDe(horizonte, ahora);
  const hasta = ahora.getTime();
  return sesiones.filter((s) => s.inicio >= desde && s.inicio <= hasta);
}

/** Ranking de una ventana concreta, ya con su tope. */
export function rankeaVentana(
  sesiones: readonly SesionPuntuada[],
  horizonte: Horizonte,
  { liga = 'global' as IdLiga, ahora = new Date() } = {},
): Ranking {
  return rankeaLiga(enVentana(sesiones, horizonte, ahora), liga, { tope: horizonte.tope });
}
