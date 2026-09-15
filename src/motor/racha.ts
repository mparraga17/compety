import { OBJETIVO_MINUTOS, calculaOms, type SesionParaOms } from './oms';
// ⛔ El lunes se calcula en `semana.ts` y en ningún otro sitio: aquí vivió el bug de cambio de
// hora que rompía la racha de todo el mundo dos veces al año (ver racha.test.ts).
import { lunesAnterior, lunesDe } from './semana';

/**
 * Racha de SEMANAS cumpliendo el objetivo de la OMS.
 *
 * ⭐⭐ Tres decisiones de diseño, cada una con su evidencia:
 *
 * 1. **SEMANAL, nunca diaria.** La racha diaria (Duolingo) castiga el día de descanso, y en
 *    deporte el descanso es parte del entrenamiento, no un fallo. El objetivo de la OMS ya
 *    está definido POR SEMANA (150 min moderados equivalentes), así que la semana es la
 *    unidad natural y además la misma que cierra la liga.
 *
 * 2. **NACE CON COMODÍN.** Journal of Consumer Research 49(6):1095: una racha rota reduce la
 *    conducta siguiente INCLUSO cuando se rompió por causas ajenas al usuario, y el efecto se
 *    atenúa si se puede reparar. Una racha sin reparación es una máquina de expulsar gente la
 *    semana que se pone enferma, y en una app de salud eso es perverso. El comodín cubre UNA
 *    semana fallada y se regenera tras 4 cumplidas: suficiente para una gripe, no tanto como
 *    para que la racha pierda significado.
 *
 * 3. **Los mensajes llevan FUENTE.** Lo pidió el usuario ("mensajes motivadores basados en la
 *    ciencia") y encaja con la tesis del producto: el estudio JAMIA señala los scores opacos
 *    como el mayor problema de confianza. Un "¡sigue así!" vacío es ruido; "cumplir el
 *    objetivo se asocia con ~25 % menos mortalidad" es información. Cada mensaje declara su
 *    ficha de ciencia, y la interfaz puede abrirla.
 *
 * ⚠️ Todo se calcula EN EL TELÉFONO desde las sesiones de HealthKit. Al servidor no sube nada
 * de esto: la racha es tuya, no compite.
 */

export type SemanaRacha = {
  /** Lunes de la semana, en ms locales. */
  inicio: number;
  /** Minutos moderados equivalentes conseguidos. */
  equivalente: number;
  cumplida: boolean;
};

export type Racha = {
  /** Semanas seguidas cumpliendo, contando comodines usados. */
  semanas: number;
  /** true si la semana EN CURSO ya está cumplida. No cuenta en `semanas` hasta cerrarse. */
  actualCumplida: boolean;
  /** Comodines disponibles (0 o 1). */
  comodines: number;
  /** Semanas en que se usó comodín dentro de la racha actual. */
  reparadas: number;
  /** Las últimas semanas evaluadas, de más reciente a más antigua. Para pintar el historial. */
  historial: readonly SemanaRacha[];
};

/** Comodines máximos en el bolsillo. Uno: cubre la gripe, no vacía la racha de significado. */
export const COMODINES_MAX = 1;

/** Semanas cumplidas seguidas que regeneran un comodín. */
export const SEMANAS_POR_COMODIN = 4;

/**
 * Calcula la racha desde las sesiones disponibles.
 *
 * ⚠️ Con 30 días de historial (lo que trae el motor) la racha máxima visible son ~4 semanas.
 * Suficiente para arrancar; si algún día se quiere una racha larga habrá que persistir las
 * semanas cumplidas en el almacén local, no releer un año de HealthKit.
 */
export function calculaRacha(
  sesiones: readonly SesionParaOms[],
  ahora: Date = new Date(),
): Racha {
  const estaSemana = lunesDe(ahora.getTime());

  // Agrupa las sesiones por su lunes.
  const porSemana = new Map<number, SesionParaOms[]>();
  for (const s of sesiones) {
    const lunes = lunesDe(s.inicio);
    const lista = porSemana.get(lunes);
    if (lista === undefined) porSemana.set(lunes, [s]);
    else lista.push(s);
  }

  // Evalúa cada semana con historial, de la más reciente hacia atrás, empezando por la
  // anterior a la actual (la actual no cierra hasta el lunes).
  const semanasConDatos = [...porSemana.keys()].sort((a, b) => b - a);
  const masAntigua = semanasConDatos[semanasConDatos.length - 1] ?? estaSemana;

  const historial: SemanaRacha[] = [];
  for (let lunes = estaSemana; lunes >= masAntigua; lunes = lunesAnterior(lunes)) {
    const oms = calculaOms(porSemana.get(lunes) ?? []);
    historial.push({
      inicio: lunes,
      equivalente: oms.equivalente,
      cumplida: oms.equivalente >= OBJETIVO_MINUTOS,
    });
  }

  const actual = historial[0];
  const cerradas = historial.slice(1);

  // Cuenta la racha con comodines: un fallo se repara si hay comodín en ese momento.
  // Se recorre de la semana más reciente cerrada hacia atrás. El comodín se gana cumpliendo
  // SEMANAS_POR_COMODIN seguidas, así que para saber si había comodín al fallar hay que
  // contar desde el fallo hacia atrás... que es equivalente a: se permite 1 fallo por cada
  // tramo de 4 cumplidas anteriores al fallo, con tope de bolsillo 1.
  let semanas = 0;
  let reparadas = 0;
  let comodines = COMODINES_MAX; // Se arranca con uno: la primera gripe no borra la racha.
  let cumplidasSeguidas = 0;

  for (const sem of cerradas) {
    if (sem.cumplida) {
      semanas += 1;
      cumplidasSeguidas += 1;
      if (cumplidasSeguidas >= SEMANAS_POR_COMODIN && comodines < COMODINES_MAX) {
        comodines += 1;
        cumplidasSeguidas = 0;
      }
    } else if (comodines > 0) {
      comodines -= 1;
      reparadas += 1;
      semanas += 1; // La semana reparada no rompe: cuenta como parte de la racha.
      cumplidasSeguidas = 0;
    } else {
      break; // Sin comodín, la racha termina aquí.
    }
  }

  return {
    semanas,
    actualCumplida: actual?.cumplida ?? false,
    comodines,
    reparadas,
    historial,
  };
}

/**
 * Mensaje motivador de la racha, CON su fuente.
 *
 * Devuelve la clave de i18n y la ficha de ciencia que lo respalda, nunca la frase hecha:
 * el texto vive en `textos.ts` en los dos idiomas, y la ficha se abre al tocarlo.
 *
 * Los números que se citan, verificados el 7 sep 2026:
 *   ~25 % menos mortalidad cumpliendo el objetivo — cohorte prospectiva,
 *     Eur J Epidemiol 2015 (10.1007/s10654-014-9965-5).
 *   HR 0,76 al pasar de inactivo a cumplir la guía en 5 años — EPIC-Norfolk,
 *     BMJ 2019 (PubMed 31243014). O sea que EMPEZAR también cuenta, no solo mantenerse.
 *   26-31 % menos con 2-4 veces el objetivo — Circulation 2022 (AHA). Techo alto y seguro.
 */
export type MensajeRacha = {
  /**
   * Clave de i18n del mensaje. Son exactamente las que `mensajeDe` puede devolver: había un
   * `rachaEnCurso` en la unión que ninguna rama devolvía ni existía en `textos.ts`, así que
   * tipar `t[clave]` en la interfaz no compilaba. Un miembro muerto en una unión es una
   * promesa falsa al que la consume.
   */
  clave:
    | 'rachaArranca'
    | 'rachaPrimera'
    | 'rachaCorta'
    | 'rachaLarga'
    | 'rachaReparada';
  /** Semanas, para interpolar en la frase. */
  n: number;
  ciencia: 'oms' | 'dosisRespuesta';
};

export function mensajeDe(racha: Racha): MensajeRacha {
  if (racha.semanas === 0) {
    // Sin racha aún: el mensaje es que empezar ya paga (EPIC-Norfolk: HR 0,76).
    return { clave: racha.actualCumplida ? 'rachaPrimera' : 'rachaArranca', n: 0, ciencia: 'oms' };
  }
  if (racha.reparadas > 0 && racha.semanas < SEMANAS_POR_COMODIN) {
    // Se usó el comodín hace poco: reconocerlo evita que la reparación parezca trampa.
    return { clave: 'rachaReparada', n: racha.semanas, ciencia: 'oms' };
  }
  if (racha.semanas < 4) {
    return { clave: 'rachaCorta', n: racha.semanas, ciencia: 'oms' };
  }
  // Racha larga: el mensaje sube al dato de dosis-respuesta (26-31 % con 2-4x el objetivo).
  return { clave: 'rachaLarga', n: racha.semanas, ciencia: 'dosisRespuesta' };
}
