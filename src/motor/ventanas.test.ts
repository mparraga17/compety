import { DIAS_ASENTAMIENTO, DIAS_BASE, inicioDeBase, inicioDeLectura, limiteAsentado } from './ventanas';

/** Instante local. Mes 1-12. */
function local(anio: number, mes: number, dia: number, hora = 12): Date {
  return new Date(anio, mes - 1, dia, hora);
}

describe('la ventana de lectura hace anual a la clasificación anual', () => {
  it('en septiembre lee desde el 1 de enero', () => {
    expect(inicioDeLectura(local(2026, 9, 15))).toEqual(local(2026, 1, 1, 0));
  });

  it('en diciembre también: es el año en curso, no los últimos 365 días', () => {
    expect(inicioDeLectura(local(2026, 12, 31))).toEqual(local(2026, 1, 1, 0));
  });

  it('a menos de 90 días del 1 de enero lee 90 días: la base personal necesita historial', () => {
    // 15 de febrero: 45 días de año no bastan para "tu normal". Se retrocede hasta noviembre.
    const desde = inicioDeLectura(local(2026, 2, 15));
    expect(desde.getTime()).toBe(local(2026, 2, 15).getTime() - DIAS_BASE * 86_400_000);
    expect(desde.getFullYear()).toBe(2025);
  });

  it('el 1 de enero a mediodía lee 90 días hacia atrás, no cero', () => {
    const desde = inicioDeLectura(local(2026, 1, 1));
    expect(desde.getFullYear()).toBe(2025);
  });
});

describe('base y asentamiento', () => {
  it('la base son los últimos 90 días y el asentamiento 3', () => {
    const ahora = local(2026, 9, 15);
    expect(inicioDeBase(ahora)).toBe(ahora.getTime() - 90 * 86_400_000);
    expect(limiteAsentado(ahora)).toBe(ahora.getTime() - 3 * 86_400_000);
    expect(DIAS_BASE).toBe(90);
    expect(DIAS_ASENTAMIENTO).toBe(3);
  });

  it('la base nunca empieza antes que la lectura', () => {
    for (const ahora of [local(2026, 1, 10), local(2026, 2, 15), local(2026, 6, 1), local(2026, 12, 31)]) {
      expect(inicioDeBase(ahora)).toBeGreaterThanOrEqual(inicioDeLectura(ahora).getTime());
    }
  });
});
