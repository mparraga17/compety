import { ordenDeportes, tramosDeDia } from './apilado';

/**
 * Gráfico de la semana apilado por deporte (petición del usuario, 16 sep): si un día suma varios
 * deportes, cada uno es un tramo de la columna con su tinte. El orden lo decide la SEMANA, no el
 * día, para que el mismo deporte esté siempre en el mismo sitio y con el mismo tinte.
 */
const s = (tipo: string | null, puntos: number) => ({ tipo, puntos });

describe('orden de los deportes de la semana', () => {
  test('el que más puntos suma va primero', () => {
    const semana = [s('gym', 30), s('padel', 48), s('correr', 55), s('padel', 40), s('gym', 20), s('correr', 62)];
    expect(ordenDeportes(semana)).toEqual(['correr', 'padel', 'gym']);
  });

  test('en empate manda el orden de aparición, para que no baile entre recargas', () => {
    expect(ordenDeportes([s('gym', 30), s('padel', 30)])).toEqual(['gym', 'padel']);
    expect(ordenDeportes([s('padel', 30), s('gym', 30)])).toEqual(['padel', 'gym']);
  });

  test('las sesiones sin tipo cuentan como un deporte más ("Actividad"), no se pierden', () => {
    expect(ordenDeportes([s(null, 50), s('gym', 10)])).toEqual([null, 'gym']);
  });

  test('sin sesiones no hay deportes', () => {
    expect(ordenDeportes([])).toEqual([]);
  });
});

describe('tramos de un día', () => {
  const orden = ['correr', 'padel', 'gym', 'barre'];

  test('un tramo por deporte presente, de abajo arriba en el orden de la semana, con sus puntos sumados', () => {
    const viernes = [s('barre', 25), s('padel', 40), s('gym', 12), s('gym', 8)];
    expect(tramosDeDia(viernes, orden)).toEqual([
      { tipo: 'padel', puntos: 40 },
      { tipo: 'gym', puntos: 20 },
      { tipo: 'barre', puntos: 25 },
    ]);
  });

  test('un día de un solo deporte es un solo tramo', () => {
    expect(tramosDeDia([s('correr', 62)], orden)).toEqual([{ tipo: 'correr', puntos: 62 }]);
  });

  test('una sesión sin puntos (sin pulso) no pinta tramo: no se inventa la carga', () => {
    expect(tramosDeDia([s('padel', 0), s('gym', 20)], orden)).toEqual([{ tipo: 'gym', puntos: 20 }]);
    expect(tramosDeDia([s('padel', 0)], orden)).toEqual([]);
  });

  test('un deporte que no esté en el orden va al final, no desaparece', () => {
    expect(tramosDeDia([s('remo', 15), s('gym', 20)], orden)).toEqual([
      { tipo: 'gym', puntos: 20 },
      { tipo: 'remo', puntos: 15 },
    ]);
  });

  test('un día vacío no tiene tramos', () => {
    expect(tramosDeDia([], orden)).toEqual([]);
  });
});
