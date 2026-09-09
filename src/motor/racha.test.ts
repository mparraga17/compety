import { calculaRacha, mensajeDe, COMODINES_MAX } from './racha';
import type { SesionParaOms } from './oms';

/**
 * Tests de la racha semanal. Fijan las tres decisiones de diseño: semanal (no diaria),
 * comodín de nacimiento (JCR 49(6)), y mensajes con clave y fuente (nunca frase hecha).
 */

/** Lunes de la semana actual a las 10:00, menos N semanas. */
function lunes(haceSemanas: number): number {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  const desplazamiento = (d.getDay() + 6) % 7;
  return d.getTime() - desplazamiento * 86_400_000 - haceSemanas * 7 * 86_400_000;
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

describe('racha semanal', () => {
  it('cuenta semanas cerradas cumplidas, la actual aparte', () => {
    const sesiones = [sesionQueCumple(lunes(2)), sesionQueCumple(lunes(1)), sesionQueCumple(lunes(0))];
    const r = calculaRacha(sesiones);
    expect(r.semanas).toBe(2); // Las dos cerradas.
    expect(r.actualCumplida).toBe(true); // La actual va aparte hasta el lunes.
  });

  it('una semana floja consume el comodín en vez de romper la racha', () => {
    const sesiones = [
      sesionQueCumple(lunes(3)),
      sesionCorta(lunes(2)), // Semana floja: gripe.
      sesionQueCumple(lunes(1)),
    ];
    const r = calculaRacha(sesiones);
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
    const r = calculaRacha(sesiones);
    // Desde la más reciente: cumplida (1), fallo con comodín (2), fallo sin comodín: corta.
    expect(r.semanas).toBe(2);
  });

  it('sin datos no hay racha y el mensaje invita a empezar con la evidencia de EPIC-Norfolk', () => {
    const r = calculaRacha([]);
    expect(r.semanas).toBe(0);
    expect(r.comodines).toBe(COMODINES_MAX);
    const m = mensajeDe(r);
    expect(m.clave).toBe('rachaArranca');
    expect(m.ciencia).toBe('oms');
  });

  it('la racha larga sube al mensaje de dosis-respuesta', () => {
    const sesiones = [1, 2, 3, 4, 5].map((n) => sesionQueCumple(lunes(n)));
    const r = calculaRacha(sesiones);
    expect(r.semanas).toBe(5);
    expect(mensajeDe(r).clave).toBe('rachaLarga');
    expect(mensajeDe(r).ciencia).toBe('dosisRespuesta');
  });
});
