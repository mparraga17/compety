import {
  DESCUENTO,
  DESCUENTOS_CALIBRADOS,
  cargaDeclarada,
  cargaEstimada,
  cargaMedida,
  puedeMejorar,
  resuelveCarga,
} from './cargaSinFc';
import { factorModalidad } from './met';

/**
 * Lo que estos tests protegen:
 * 1. Que nadie se quede fuera del ranking por no llevar pulsera.
 * 2. Que la carga estimada quede por debajo de la medida sin llegar a cero.
 * 3. Que el pulso INFLUYA en la carga, que es el bug que se encontro al calibrar.
 */

describe('el pulso influye en la carga', () => {
  // Este es el test que protege el bug encontrado el 28 ago: el factor derivado dividia
  // por la intensidad de la sesion y la cancelaba, asi que dos carreras a ritmos distintos
  // daban la misma carga. Si alguien vuelve a meter esa division, esto falla.
  it('la misma sesion a mas intensidad puntua mas', () => {
    const suave = cargaMedida({ tipo: 'RUNNING', minutos: 45, intensidad: 2.29 });
    const fuerte = cargaMedida({ tipo: 'RUNNING', minutos: 45, intensidad: 2.96 });
    expect(fuerte.valor).toBeGreaterThan(suave.valor);
  });

  it('vale para todos los deportes con muestra, no solo para correr', () => {
    for (const tipo of ['WALKING', 'GOLF', 'TENNIS', 'STRENGTH_TRAINING']) {
      const suave = cargaMedida({ tipo, minutos: 60, intensidad: 1.0 });
      const fuerte = cargaMedida({ tipo, minutos: 60, intensidad: 2.0 });
      expect(fuerte.valor).toBeGreaterThan(suave.valor);
    }
  });

  it('el factor corrige la ceguera de la FC ante la fuerza', () => {
    // Medido: la fuerza observa 1,00 TRIMP/min, o sea 3,4 MET, cuando la tabla dice 6,0.
    const fuerza = factorModalidad('STRENGTH_TRAINING');
    expect(fuerza.factor).toBeGreaterThan(1.5);
    // En tenis el pulso ya marca de sobra, asi que no hace falta corregir al alza.
    expect(factorModalidad('TENNIS').factor).toBeLessThan(1);
  });

  it('el factor no se descontrola', () => {
    for (const tipo of Object.keys({ RUNNING: 0, PILATES: 0, BIKING: 0, YOGA: 0 })) {
      const f = factorModalidad(tipo).factor;
      expect(f).toBeGreaterThanOrEqual(0.85);
      expect(f).toBeLessThanOrEqual(1.75);
    }
  });
});

describe('sesiones sin frecuencia cardiaca', () => {
  it('una clase de barre sin pulso puntua', () => {
    const carga = cargaEstimada('BARRE', 50);
    expect(carga).not.toBeNull();
    expect(carga!.valor).toBeGreaterThan(0);
    expect(carga!.origen).toBe('estimada');
  });

  it('correr estima mas carga que caminar a igual duracion', () => {
    const correr = cargaEstimada('RUNNING', 45)!;
    const caminar = cargaEstimada('WALKING', 45)!;
    expect(correr.valor).toBeGreaterThan(caminar.valor);
  });

  it('las horas de mas pesan menos: cuatro horas de golf no cuadruplican una', () => {
    const unaHora = cargaEstimada('GOLF', 60)!;
    const cuatroHoras = cargaEstimada('GOLF', 240)!;
    expect(cuatroHoras.valor).toBeLessThan(unaHora.valor * 4);
    expect(cuatroHoras.valor).toBeGreaterThan(unaHora.valor);
  });

  it('un deporte fuera del Compendium no se puntua a ojo', () => {
    expect(cargaEstimada('DEPORTE_INVENTADO', 60)).toBeNull();
  });

  it('los deportes sin muestra propia se marcan como aproximados y se descuentan mas', () => {
    const conMuestra = cargaEstimada('RUNNING', 45)!;
    const sinMuestra = cargaEstimada('PILATES', 45)!;
    expect(conMuestra.aproximado).toBeFalsy();
    expect(sinMuestra.aproximado).toBe(true);
    expect(sinMuestra.descuento).toBeLessThan(conMuestra.descuento);
  });

  it('declarar un esfuerzo alto puntua mas que dejarlo estimado', () => {
    const estimada = cargaEstimada('STRENGTH_TRAINING', 60)!;
    const duro = cargaDeclarada(9, 60, 'STRENGTH_TRAINING');
    expect(duro.valor).toBeGreaterThan(estimada.valor);
  });

  it('el esfuerzo declarado se acota entre 1 y 10', () => {
    expect(cargaDeclarada(-5, 30, 'BARRE').valor).toBe(cargaDeclarada(1, 30, 'BARRE').valor);
    expect(cargaDeclarada(99, 30, 'BARRE').valor).toBe(cargaDeclarada(10, 30, 'BARRE').valor);
  });

  it('declarar mas esfuerzo siempre da mas carga', () => {
    const valores = [1, 3, 5, 7, 10].map((r) => cargaDeclarada(r, 45, 'BARRE').valor);
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeGreaterThan(valores[i - 1]);
    }
  });
});

describe('eleccion de la via', () => {
  it('el pulso medido manda sobre todo lo demas', () => {
    const carga = resuelveCarga({ tipo: 'RUNNING', minutos: 45, intensidad: 2.8, rpe: 3 });
    expect(carga!.origen).toBe('medida');
    expect(carga!.descuento).toBe(1);
  });

  it('sin pulso pero con esfuerzo declarado usa el declarado', () => {
    const carga = resuelveCarga({ tipo: 'BARRE', minutos: 50, intensidad: null, rpe: 7 });
    expect(carga!.origen).toBe('declarada');
  });

  it('sin pulso y sin respuesta cae a la estimacion por deporte', () => {
    expect(resuelveCarga({ tipo: 'PADEL', minutos: 90 })!.origen).toBe('estimada');
  });

  it('solo se ofrece mejorar cuando la carga no viene del pulso', () => {
    expect(puedeMejorar(resuelveCarga({ tipo: 'RUNNING', minutos: 30, intensidad: 2.8 })!)).toBe(false);
    expect(puedeMejorar(resuelveCarga({ tipo: 'RUNNING', minutos: 30 })!)).toBe(true);
  });
});

describe('descuentos calibrados', () => {
  it('estan calibrados contra datos reales', () => {
    expect(DESCUENTOS_CALIBRADOS).toBe(true);
  });

  it('estimar penaliza mas que declarar, y declarar mas que medir', () => {
    expect(DESCUENTO.estimada).toBeLessThan(DESCUENTO.declarada);
    expect(DESCUENTO.declarada).toBeLessThan(1);
  });

  it('el descuento no expulsa a nadie: penaliza poco, no castiga', () => {
    // Calibrado: con x0,95 solo el 9 % de las sesiones ganaria por no llevar pulsera, y la
    // penalizacion mediana es del 5 %. Bajar a 0,75 lo dejaria en 0 % pero castigaria al
    // 100 % de la gente sin pulsera, que es el error del filtro de intensidad minima.
    expect(DESCUENTO.estimada).toBeGreaterThanOrEqual(0.9);
  });

  it('una sesion estimada nunca vale mas que la misma medida a intensidad tipica', () => {
    // WALKING tiene intensidad tipica 1,00 medida sobre 21 sesiones.
    const medida = cargaMedida({ tipo: 'WALKING', minutos: 40, intensidad: 1.0 });
    const estimada = cargaEstimada('WALKING', 40)!;
    expect(estimada.valor).toBeLessThan(medida.valor);
  });
});
