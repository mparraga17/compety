import { claveSemana, lunesAnterior, lunesDe } from './semana';

/** Un instante en hora local. Mes 1-12. La suite corre en Europe/Madrid (jest.zona-horaria.js). */
function local(anio: number, mes: number, dia: number, hora = 0, minuto = 0): number {
  return new Date(anio, mes - 1, dia, hora, minuto).getTime();
}

describe('lunesDe', () => {
  it('cualquier día de la semana lleva a su lunes a las 00:00', () => {
    const lunes = local(2026, 9, 14);
    for (let d = 14; d <= 20; d++) {
      expect(lunesDe(local(2026, 9, d, 15, 30))).toBe(lunes);
    }
  });

  it('el lunes a las 00:00 es su propio lunes, y el domingo a las 23:59 aún es de la semana anterior', () => {
    expect(lunesDe(local(2026, 9, 14))).toBe(local(2026, 9, 14));
    expect(lunesDe(local(2026, 9, 13, 23, 59))).toBe(local(2026, 9, 7));
  });

  it('cruza el cambio de mes y de año por calendario', () => {
    // Jueves 1 de enero de 2026: su lunes es el 29 de diciembre de 2025.
    expect(lunesDe(local(2026, 1, 1))).toBe(local(2025, 12, 29));
  });

  it('en la semana del cambio de hora todos los días caen en el mismo lunes', () => {
    // Domingo 29 mar 2026 cambia la hora (02:00 → 03:00). Antes y después del salto.
    const lunes = local(2026, 3, 23);
    expect(lunesDe(local(2026, 3, 29, 1, 30))).toBe(lunes);
    expect(lunesDe(local(2026, 3, 29, 3, 30))).toBe(lunes);
    expect(lunesDe(local(2026, 3, 29, 23, 59))).toBe(lunes);
    // Y la semana del cambio de octubre (25 oct, 03:00 → 02:00) igual.
    expect(lunesDe(local(2026, 10, 25, 23, 59))).toBe(local(2026, 10, 19));
  });
});

describe('lunesAnterior', () => {
  it('encadena lunes a medianoche a través de los dos cambios de hora', () => {
    // De abril hacia atrás hasta febrero, y de noviembre hacia atrás hasta septiembre: ningún
    // lunes puede salir a las 23:00 del domingo ni a la 01:00. Es el bug que rompía la racha.
    for (const arranque of [local(2026, 4, 13), local(2026, 11, 9)]) {
      let lunes = arranque;
      for (let i = 0; i < 10; i++) {
        lunes = lunesAnterior(lunes);
        const d = new Date(lunes);
        expect(d.getDay()).toBe(1);
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
      }
    }
  });

  it('el anterior de un lunes concreto es exactamente siete días de calendario antes', () => {
    expect(lunesAnterior(local(2026, 3, 30))).toBe(local(2026, 3, 23)); // 169 h reales.
    expect(lunesAnterior(local(2026, 10, 26))).toBe(local(2026, 10, 19)); // 167 h reales.
    // Y en una semana normal, 168 h: la aritmética de horas y la de calendario coinciden.
    expect(lunesAnterior(local(2026, 9, 14))).toBe(local(2026, 9, 14) - 7 * 86_400_000);
  });
});

describe('claveSemana', () => {
  it('toda la semana comparte clave, y la siguiente cambia', () => {
    expect(claveSemana(local(2026, 9, 14, 8))).toBe('2026-9-14');
    expect(claveSemana(local(2026, 9, 20, 23))).toBe('2026-9-14');
    expect(claveSemana(local(2026, 9, 21))).toBe('2026-9-21');
  });
});
