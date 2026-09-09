import { COHORTE_MAXIMA, cuantosMueven, franjaDe } from './divisiones';

/**
 * Tests de las divisiones de zona. Fijan la regla que está REPLICADA en el servidor
 * (`cuantos_mueven` en migracion-06-zonas.sql): si un test de aquí falla al cambiar la
 * regla, hay que cambiar también el SQL.
 */

describe('cuantosMueven', () => {
  it('con menos de 4 nadie se mueve: en una liga de 2 mover es ruido', () => {
    expect(cuantosMueven(0)).toBe(0);
    expect(cuantosMueven(1)).toBe(0);
    expect(cuantosMueven(2)).toBe(0);
    expect(cuantosMueven(3)).toBe(0);
  });

  it('escala con el tamaño: 1 de 4 a 7, 2 de 8 a 11, 3 desde 12', () => {
    expect(cuantosMueven(4)).toBe(1);
    expect(cuantosMueven(7)).toBe(1);
    expect(cuantosMueven(8)).toBe(2);
    expect(cuantosMueven(11)).toBe(2);
    expect(cuantosMueven(12)).toBe(3);
  });

  it('el tope es 3 incluso con la cohorte llena', () => {
    expect(cuantosMueven(COHORTE_MAXIMA)).toBe(3);
    expect(cuantosMueven(100)).toBe(3);
  });
});

describe('franjaDe', () => {
  const media = { primera: false, ultima: false };

  it('en una división intermedia de 8, suben los 2 primeros y bajan los 2 últimos', () => {
    expect(franjaDe(1, 8, media)).toBe('sube');
    expect(franjaDe(2, 8, media)).toBe('sube');
    expect(franjaDe(3, 8, media)).toBe('queda');
    expect(franjaDe(6, 8, media)).toBe('queda');
    expect(franjaDe(7, 8, media)).toBe('baja');
    expect(franjaDe(8, 8, media)).toBe('baja');
  });

  it('en la División 1 nadie sube, ni el primero', () => {
    expect(franjaDe(1, 8, { primera: true, ultima: false })).toBe('queda');
    expect(franjaDe(8, 8, { primera: true, ultima: false })).toBe('baja');
  });

  it('en la división más baja nadie baja, ni el último', () => {
    expect(franjaDe(8, 8, { primera: false, ultima: true })).toBe('queda');
    expect(franjaDe(1, 8, { primera: false, ultima: true })).toBe('sube');
  });

  it('cuando la zona tiene una sola división, nadie se mueve', () => {
    expect(franjaDe(1, 8, { primera: true, ultima: true })).toBe('queda');
    expect(franjaDe(8, 8, { primera: true, ultima: true })).toBe('queda');
  });

  it('con 3 miembros no hay franjas aunque haya división arriba y abajo', () => {
    expect(franjaDe(1, 3, media)).toBe('queda');
    expect(franjaDe(3, 3, media)).toBe('queda');
  });
});
