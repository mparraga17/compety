import { tipoDe } from './actividades';
import { baseDeCarga, puntuaCarga, type Base } from './base';
import { resuelveCarga, type Carga, type Paso } from './cargaSinFc';
import { ligaDe, type IdLiga } from './ligas';
import { resumenDe, type SesionFusionada } from './fusion';
import { esValida, type SesionPuntuada } from './ranking';
import { RESUMEN_VACIO, fcMediaDe, zonasDeResumen, type Zonas } from './zonas';

/**
 * Ensamblaje del motor. Une lo que ya estaba suelto: zonas desde los pulsos, carga por la via
 * disponible, base personal y puntos.
 *
 * ⚠️ Se hace en DOS PASADAS y el orden importa. La puntuacion sale de comparar la carga con tu
 * media, asi que primero hay que calcular todas las cargas y solo despues la base. Puntuar
 * sobre la marcha daria z sin sentido en las primeras sesiones.
 */

/** Los pasos de la carga, mas el paso final que compara con tu base personal. */
export type PasoSesion = Paso | { clave: 'contraTuBase'; datos: Record<string, number> };

export type Sesion = SesionPuntuada & {
  fin: number;
  fuentes: readonly string[];
  liga: IdLiga | null;
  zonas: Zonas | null;
  /** Segundos por metro, cuando hay GPS. */
  ritmo: number | null;
  fcMedia: number | null;
  metros: number | null;
  kcal: number | null;
  origen: Carga['origen'];
  /**
   * Pasos del desglose explicable. Cada uno lleva su clave y sus cifras, nunca la frase hecha,
   * para que se pueda mostrar en cualquier idioma.
   */
  pasos: readonly PasoSesion[];
  aproximado: boolean;
  /** Ids originales antes de fusionar. Evita notificar dos veces la misma sesion. */
  ids: readonly string[];
  /** true si el entreno se tecleo en Salud y ningun dispositivo lo grabo. Puntua sin pulso. */
  manual: boolean;
};

export type Resultado = {
  sesiones: readonly Sesion[];
  base: Base;
  /**
   * Desde cuando (ms) entran las sesiones en la base personal. null si entraron todas. Las
   * pantallas lo usan para acotar lo que enseñan a la misma ventana que define "tu normal".
   */
  baseDesde: number | null;
  /** Sesiones que no llegan al minimo de duracion o sin carga calculable. */
  descartadas: number;
  /** Cuantas puntuan sin pulso. Sirve para ofrecer el deslizador de esfuerzo. */
  sinPulso: number;
};

/** Entrada del motor. El rpe lo aporta la app, no HealthKit. */
export type EntradaSesion = SesionFusionada & {
  /** Codigo de actividad de HealthKit, para traducirlo al tipo del motor. */
  actividad?: number | string | null;
  /** Esfuerzo declarado de 1 a 10, si el usuario lo respondio. */
  rpe?: number | null;
};

/**
 * Primera pasada: zonas y carga. Los puntos todavia no, porque hace falta la base.
 */
function preparaSesion(entrada: EntradaSesion, maximo: number) {
  const tipo = entrada.tipo ?? tipoDe(entrada.actividad);
  const minutos = entrada.segundos / 60;
  // ⛔ Un entreno tecleado a mano NO tiene pulso propio: los pulsos de ese rango de horas los
  // midio otra cosa. Se ignoran aunque lleguen, asi que la carga sale por esfuerzo declarado o
  // por estimacion, con su descuento, nunca como "medida". Es la regla de producto (15 sep): no
  // puede puntuar igual un entreno con frecuencia cardiaca que uno sin ella, y el que se teclea
  // es, por definicion, uno sin ella. El deslizador de esfuerzo sigue disponible para mejorarlo.
  const resumen = entrada.manual ? RESUMEN_VACIO : resumenDe(entrada);
  const zonas = zonasDeResumen(resumen, maximo);

  const carga = resuelveCarga({
    tipo: tipo ?? '',
    minutos,
    intensidad: zonas?.intensidad ?? null,
    rpe: entrada.rpe ?? null,
  });

  return { entrada, tipo, minutos, zonas, carga, fcMedia: fcMediaDe(resumen) };
}

export type OpcionesProcesa = {
  /**
   * ⭐ Desde cuando (ms) cuentan las sesiones para la base personal. Las anteriores se PUNTUAN
   * igual, contra esa base, pero no la definen.
   *
   * Existe porque el motor pasa a leer el año entero (para que la clasificacion anual sea de
   * verdad anual) y "tu normal" no puede ser la media de enero: es lo que haces ultimamente. Con
   * una ventana fija, la base es la misma la lea quien la lea (la pantalla o la sincronizacion),
   * y los puntos que ves son los que suben.
   */
  baseDesde?: number;
};

/**
 * Procesa sesiones ya deduplicadas.
 *
 * @param maximo maximo de referencia de FC, de `maximoDeReferencia`. Si es provisional la
 *   interfaz tiene que avisar, porque infla las intensidades.
 */
export function procesa(
  entradas: readonly EntradaSesion[],
  maximo: number,
  { baseDesde }: OpcionesProcesa = {},
): Resultado {
  const preparadas = entradas.map((e) => preparaSesion(e, maximo));
  const conCarga = preparadas.filter((p) => p.carga !== null);

  // Segunda pasada: base personal sobre la escala de carga real, y de ahi los puntos.
  const paraLaBase =
    baseDesde === undefined ? conCarga : conCarga.filter((p) => p.entrada.inicio >= baseDesde);
  const base = baseDeCarga(paraLaBase.map((p) => p.carga!.valor));

  const sesiones: Sesion[] = conCarga.map(({ entrada, tipo, minutos, zonas, carga, fcMedia }) => {
    const p = puntuaCarga(carga!.valor, base);
    return {
      id: entrada.id,
      ids: entrada.ids,
      inicio: entrada.inicio,
      fin: entrada.fin,
      tipo,
      liga: ligaDe(tipo),
      minutos: +minutos.toFixed(1),
      carga: carga!.valor,
      puntos: p.puntos,
      sinPulso: carga!.origen !== 'medida',
      fuentes: entrada.fuentes,
      zonas,
      ritmo: entrada.ritmo ?? null,
      // En un manual es null: sin pulso propio no hay media que enseñar, seria la de otra cosa.
      fcMedia,
      metros: entrada.metros ?? null,
      kcal: entrada.kcal ?? null,
      origen: carga!.origen,
      // El paso final es la comparacion con tu base. Va como un paso mas del desglose, con sus
      // cifras y sin texto: la frase la arma la interfaz en el idioma que toque.
      pasos: [
        ...carga!.pasos,
        { clave: 'contraTuBase' as const, datos: p.datos ?? {} },
      ],
      aproximado: carga!.aproximado === true,
      manual: entrada.manual,
    };
  });

  const validas = sesiones.filter(esValida);

  return {
    sesiones: sesiones.sort((a, b) => b.inicio - a.inicio),
    base,
    baseDesde: baseDesde ?? null,
    descartadas: entradas.length - validas.length,
    sinPulso: validas.filter((s) => s.sinPulso).length,
  };
}
