import { calculaRacha, mensajeDe, COMODINES_MAX } from './racha';
import type { SesionParaOms } from './oms';

/**
 * Tests de la racha semanal. Fijan las tres decisiones de diseño: semanal (no diaria),
 * comodín de nacimiento (JCR 49(6)), y mensajes con clave y fuente (nunca frase hecha).
 *
 * ⚠️ Fechas FIJAS y en hora local (la suite corre en Europe/Madrid, ver jest.zona-horaria.js).
 * La versión anterior de este fichero construía los lunes con `new Date()` y restando
 * `7 × 86.400.000 ms`: era no determinista (dependía del día en que corriera) y, peor, repetía la
 * misma aritmética que el bug de cambio de hora que se describe abajo, así que no podía cazarlo.
 */

/** Un instante en hora local. Mes 1-12, como lo lee una persona. */
function local(anio: number, mes: number, dia: number, hora = 10): number {
  return new Date(anio, mes - 1, dia, hora).getTime();
}

/** Lunes 2026-09-14 a las 10:00: sin cambio de hora en las semanas anteriores. */
const AHORA = new Date(local(2026, 9, 14));

/** Lunes 10:00 de hace N semanas respecto a AHORA, por calendario (no restando horas). */
function lunes(haceSemanas: number): number {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - haceSemanas * 7);
  return d.getTime();
}

/** Una sesión que aporta ~160 min equivalentes: cumple la semana ella sola. */
function sesionQueCumple(inicio: number): SesionParaOms {
  return {
    inicio,
    tipo: 'RUNNING',
    // 80 min de zona vigorosa = 160 equivalentes (falta poco para el techo, pero cumple).
    zonas: {
      segundos: [0, 0, 4800, 0],
      trimp: 240,
      intensidad: 3,
      maximoUsado: 190,
    },
  };
}

/** Una sesión corta que NO cumple: 20 min moderados = 20 equivalentes. */
function sesionCorta(inicio: number): SesionParaOms {
  return {
    inicio,
    tipo: 'WALKING',
    zonas: { segundos: [0, 1200, 0, 0], trimp: 40, intensidad: 2, maximoUsado: 190 },
  };
}

/** Todas las semanas del historial empiezan un lunes a las 00:00 LOCAL. Es el invariante. */
function esLunesAMedianoche(ms: number): boolean {
  const d = new Date(ms);
  return d.getDay() === 1 && d.getHours() === 0 && d.getMinutes() === 0;
}

describe('la suite corre en Europe/Madrid', () => {
  it('con horario de verano en verano y de invierno en invierno', () => {
    // Si esto falla, jest.zona-horaria.js no se está aplicando y los tests de abajo no prueban nada.
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120); // CEST, UTC+2
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60); // CET, UTC+1
  });
});

describe('racha semanal', () => {
  it('cuenta semanas cerradas cumplidas, la actual aparte', () => {
    const sesiones = [sesionQueCumple(lunes(2)), sesionQueCumple(lunes(1)), sesionQueCumple(lunes(0))];
    const r = calculaRacha(sesiones, AHORA);
    expect(r.semanas).toBe(2); // Las dos cerradas.
    expect(r.actualCumplida).toBe(true); // La actual va aparte hasta el lunes.
  });

  it('una semana floja consume el comodín en vez de romper la racha', () => {
    const sesiones = [
      sesionQueCumple(lunes(3)),
      sesionCorta(lunes(2)), // Semana floja: gripe.
      sesionQueCumple(lunes(1)),
    ];
    const r = calculaRacha(sesiones, AHORA);
    expect(r.semanas).toBe(3); // 1 cumplida + 1 reparada + 1 cumplida.
    expect(r.reparadas).toBe(1);
    expect(r.comodines).toBe(0); // Gastado.
  });

  it('dos fallos sin comodín SÍ rompen: la reparación no es infinita', () => {
    const sesiones = [
      sesionQueCumple(lunes(4)),
      sesionCorta(lunes(3)), // Primer fallo: comodín.
      sesionCorta(lunes(2)), // Segundo fallo: sin comodín, rompe.
      sesionQueCumple(lunes(1)),
    ];
    const r = calculaRacha(sesiones, AHORA);
    // Desde la más reciente: cumplida (1), fallo con comodín (2), fallo sin comodín: corta.
    expect(r.semanas).toBe(2);
  });

  it('sin datos no hay racha y el mensaje invita a empezar con la evidencia de EPIC-Norfolk', () => {
    const r = calculaRacha([], AHORA);
    expect(r.semanas).toBe(0);
    expect(r.comodines).toBe(COMODINES_MAX);
    const m = mensajeDe(r);
    expect(m.clave).toBe('rachaArranca');
    expect(m.ciencia).toBe('oms');
  });

  it('la racha larga sube al mensaje de dosis-respuesta', () => {
    const sesiones = [1, 2, 3, 4, 5].map((n) => sesionQueCumple(lunes(n)));
    const r = calculaRacha(sesiones, AHORA);
    expect(r.semanas).toBe(5);
    expect(mensajeDe(r).clave).toBe('rachaLarga');
    expect(mensajeDe(r).ciencia).toBe('dosisRespuesta');
  });

  it('una sesión del domingo por la noche cuenta en SU semana, no en la siguiente', () => {
    // Domingo 13 sep 23:30: pertenece a la semana del lunes 7, que cierra a medianoche.
    const r = calculaRacha([sesionQueCumple(local(2026, 9, 13, 23))], AHORA);
    expect(r.semanas).toBe(1);
    expect(r.actualCumplida).toBe(false);
  });
});

/**
 * ⛔⛔ El bug de cambio de hora, reproducido.
 *
 * El historial se recorría restando `7 × 86.400.000 ms` al lunes actual, y las sesiones se
 * agrupaban por su lunes REAL a las 00:00 locales. Una semana de 7 días tiene 7 × 24 h... salvo
 * la del cambio de hora, que tiene 167 o 169. Al cruzarla hacia atrás, el "lunes" calculado caía
 * a las 23:00 del domingo (o a la 01:00 del lunes), la clave ya no coincidía con la del grupo, y
 * TODAS las semanas anteriores al cambio se evaluaban vacías: la primera gastaba el comodín y la
 * segunda rompía la racha. Dos veces al año, para todo el mundo, sin que nadie hubiera fallado.
 */
describe('la racha sobrevive al cambio de hora', () => {
  it('al entrar el horario de verano (29 mar 2026, 02:00 → 03:00)', () => {
    // Cuatro semanas cumplidas seguidas: tres en horario de invierno y una ya en verano.
    const ahora = new Date(local(2026, 4, 6)); // Lunes 6 abr, CEST.
    const sesiones = [
      sesionQueCumple(local(2026, 3, 9)), // Lunes 9 mar, CET.
      sesionQueCumple(local(2026, 3, 16)), // CET.
      sesionQueCumple(local(2026, 3, 23)), // CET, la última antes del cambio.
      sesionQueCumple(local(2026, 3, 30)), // CEST.
    ];
    const r = calculaRacha(sesiones, ahora);
    expect(r.semanas).toBe(4);
    expect(r.reparadas).toBe(0);
    expect(r.comodines).toBe(COMODINES_MAX); // Intacto: nadie falló.
    expect(r.historial.every((s) => esLunesAMedianoche(s.inicio))).toBe(true);
  });

  it('al salir del horario de verano (25 oct 2026, 03:00 → 02:00)', () => {
    const ahora = new Date(local(2026, 11, 2)); // Lunes 2 nov, CET.
    const sesiones = [
      sesionQueCumple(local(2026, 10, 5)), // CEST.
      sesionQueCumple(local(2026, 10, 12)), // CEST.
      sesionQueCumple(local(2026, 10, 19)), // CEST, la última antes del cambio.
      sesionQueCumple(local(2026, 10, 26)), // CET.
    ];
    const r = calculaRacha(sesiones, ahora);
    expect(r.semanas).toBe(4);
    expect(r.reparadas).toBe(0);
    expect(r.historial.every((s) => esLunesAMedianoche(s.inicio))).toBe(true);
  });

  it('la semana del cambio agrupa igual sus siete días', () => {
    // Sesiones cortas repartidas por la semana del 23 al 29 de marzo (el domingo 29 cambia la
    // hora). Sumadas cumplen; si alguna cayera en otra clave, la semana quedaría floja.
    const ahora = new Date(local(2026, 3, 30));
    const dias = [23, 24, 25, 26, 27, 28, 29].map((d) => sesionCorta(local(2026, 3, d, 20)));
    // 7 × 20 = 140 equivalentes: falta poco. Se añade una octava el domingo a las 23:00.
    const r = calculaRacha([...dias, sesionCorta(local(2026, 3, 29, 23))], ahora);
    expect(r.historial[1].equivalente).toBe(160);
    expect(r.semanas).toBe(1);
  });
});
