import { procesa, type EntradaSesion } from './sesiones';

/**
 * Tests del ensamblador del motor: zonas → carga → base → puntos. Hasta hoy no tenía ninguno.
 * Los primeros fijan la regla de los entrenos a mano y las dos pasadas del cálculo.
 */

const MIN = 60_000;
const T0 = new Date(2026, 8, 14, 18, 0).getTime();
const MAXIMO = 190;

/** Pulsos a un ritmo fijo, uno por minuto: una sesión claramente intensa a 170 lpm. */
function pulsos(minutos: number, lpm = 170, desde = T0): EntradaSesion['pulsos'] {
  return Array.from({ length: minutos }, (_, i) => ({
    valor: lpm,
    inicio: new Date(desde + i * MIN),
    fin: new Date(desde + i * MIN),
  }));
}

function entrada(p: Partial<EntradaSesion> & { id: string }): EntradaSesion {
  const inicio = p.inicio ?? T0;
  const fin = p.fin ?? inicio + 45 * MIN;
  return {
    tipo: 'RUNNING',
    fuente: 'Fitbit',
    inicio,
    fin,
    segundos: (fin - inicio) / 1000,
    pulsos: [],
    fuentes: [p.fuente ?? 'Fitbit'],
    fusionada: false,
    ids: [p.id],
    manual: false,
    ...p,
  };
}

describe('entrenos a mano', () => {
  it('nunca puntúan como medidos aunque haya pulsos en su rango de horas', () => {
    // La misma sesión de 45 min, con los mismos pulsos: grabada frente a tecleada.
    const grabada = entrada({ id: 'g', pulsos: pulsos(45) });
    const tecleada = entrada({ id: 'm', pulsos: pulsos(45), manual: true });

    const [g] = procesa([grabada], MAXIMO).sesiones;
    const [m] = procesa([tecleada], MAXIMO).sesiones;

    expect(g.origen).toBe('medida');
    expect(g.zonas).not.toBeNull();
    expect(g.fcMedia).toBe(170);

    expect(m.origen).toBe('estimada');
    expect(m.sinPulso).toBe(true);
    expect(m.zonas).toBeNull();
    expect(m.fcMedia).toBeNull();
    expect(m.manual).toBe(true);
  });

  it('con FC y sin FC no puntúa igual: la misma caminata tecleada vale menos que grabada con esfuerzo', () => {
    // 45 min andando a 140 lpm (paso vivo, medido) frente a los mismos 45 min tecleados: la
    // tecleada solo puede recibir la intensidad TÍPICA del deporte con descuento, así que queda
    // por debajo. Es la regla de producto en una frase.
    const grabada = entrada({ id: 'g', tipo: 'WALKING', pulsos: pulsos(45, 140) });
    const tecleada = entrada({ id: 'm', tipo: 'WALKING', manual: true });
    const r = procesa([grabada, tecleada], MAXIMO);
    const g = r.sesiones.find((s) => s.id === 'g')!;
    const m = r.sesiones.find((s) => s.id === 'm')!;
    expect(g.origen).toBe('medida');
    expect(m.origen).toBe('estimada');
    expect(m.carga).toBeLessThan(g.carga);
    expect(m.puntos).toBeLessThan(g.puntos);
  });

  it('el esfuerzo declarado sí mejora una sesión tecleada', () => {
    const sinRpe = procesa([entrada({ id: 'm', tipo: 'BARRE', manual: true })], MAXIMO).sesiones[0];
    const conRpe = procesa([entrada({ id: 'm', tipo: 'BARRE', manual: true, rpe: 9 })], MAXIMO).sesiones[0];
    expect(conRpe.origen).toBe('declarada');
    expect(conRpe.carga).toBeGreaterThan(sinRpe.carga);
  });
});

describe('las dos pasadas', () => {
  it('la base personal sale de TODAS las cargas antes de puntuar ninguna', () => {
    // Tres sesiones iguales y una el doble de larga: la base es la media de las cuatro, y la
    // larga puntúa por encima de 50 mientras las cortas quedan por debajo.
    const r = procesa(
      [
        entrada({ id: 'a', pulsos: pulsos(30), fin: T0 + 30 * MIN }),
        entrada({ id: 'b', pulsos: pulsos(30), fin: T0 + 30 * MIN }),
        entrada({ id: 'c', pulsos: pulsos(30), fin: T0 + 30 * MIN }),
        entrada({ id: 'd', pulsos: pulsos(60), fin: T0 + 60 * MIN }),
      ],
      MAXIMO,
    );
    expect(r.base.n).toBe(4);
    const larga = r.sesiones.find((s) => s.id === 'd')!;
    const corta = r.sesiones.find((s) => s.id === 'a')!;
    expect(larga.puntos).toBeGreaterThan(50);
    expect(corta.puntos).toBeLessThan(50);
  });

  it('sin historial suficiente todo el mundo se queda en la media: no se inventa un z', () => {
    const [sola] = procesa([entrada({ id: 'a', pulsos: pulsos(45) })], MAXIMO).sesiones;
    expect(sola.puntos).toBe(50);
  });

  it('las sesiones salen de la más reciente a la más antigua', () => {
    const r = procesa(
      [entrada({ id: 'vieja', inicio: T0 - 3 * 24 * 60 * MIN }), entrada({ id: 'nueva' })],
      MAXIMO,
    );
    expect(r.sesiones.map((s) => s.id)).toEqual(['nueva', 'vieja']);
  });
});
