import { ligaDe, type IdLiga } from './ligas';

/**
 * Eje de forma: hacer lo mismo con menos pulso.
 *
 * Lo pidio el usuario y tiene respaldo directo. En un ensayo aleatorizado de 12 semanas con
 * 45 mujeres, el pulso en reposo bajo de 4 a 5 lpm y caminando a la misma velocidad bajo 3 lpm.
 * https://pubmed.ncbi.nlm.nih.gov/28932907/
 *
 * Se mide con el coste cardiaco, que son pulsaciones por unidad de velocidad. Menos es mejor.
 *
 * ⚠️ Limites del estudio original, declarados porque cambian como se cita: solo mujeres
 * premenopausicas inactivas, n=45. Vale para fundamentar el eje, no para extrapolar.
 */

export type SesionConRitmo = {
  inicio: number;
  tipo: string | null;
  /** Segundos por metro. */
  ritmo: number | null;
  fcMedia: number | null;
};

export type Forma =
  | { disponible: false; motivo: 'pocas-sesiones'; encontradas: number; minimo: number }
  | {
      disponible: true;
      /** Porcentaje de mejora del coste cardiaco. Positivo es mejor. */
      mejoraPct: number;
      mejora: boolean;
      fcAntes: number;
      fcAhora: number;
      sesiones: { antes: number; ahora: number };
      /** false con pocas sesiones. La interfaz tiene que avisar de que la senal es debil. */
      fiable: boolean;
      liga: IdLiga;
      ciencia: 'eficiencia';
    };

/** Comparables minimas para intentarlo. Por debajo el ruido se come la senal. */
export const SESIONES_MINIMAS = 4;

/** A partir de aqui la senal se considera fiable. */
export const SESIONES_FIABLES = 8;

/**
 * Compara el coste cardiaco de la primera mitad del historial con la segunda.
 *
 * Solo dentro de la misma liga: comparar el pulso de correr con el de golf no dice nada.
 * El corte va por la mediana temporal y no por una fecha fija, asi que funciona con cualquier
 * historial en vez de exigir datos justo a ambos lados de un dia arbitrario.
 */
export function calculaForma(
  sesiones: readonly SesionConRitmo[],
  { liga = 'correr' as IdLiga } = {},
): Forma {
  const comparables = sesiones
    .filter((s) => s.ritmo != null && s.ritmo > 0 && s.fcMedia != null && s.fcMedia > 0)
    .filter((s) => ligaDe(s.tipo) === liga)
    .sort((a, b) => a.inicio - b.inicio);

  if (comparables.length < SESIONES_MINIMAS) {
    return {
      disponible: false,
      motivo: 'pocas-sesiones',
      encontradas: comparables.length,
      minimo: SESIONES_MINIMAS,
    };
  }

  const mitad = Math.floor(comparables.length / 2);
  const previas = comparables.slice(0, mitad);
  const recientes = comparables.slice(mitad);

  // Coste cardiaco: lpm por unidad de velocidad. El ritmo viene en s/m, asi que la velocidad
  // es 1/ritmo y el coste queda lpm x s/m.
  const coste = (lista: readonly SesionConRitmo[]) =>
    lista.reduce((a, s) => a + s.fcMedia! * s.ritmo!, 0) / lista.length;

  const antes = coste(previas);
  const ahora = coste(recientes);
  const mejoraPct = +(((antes - ahora) / antes) * 100).toFixed(1);

  const media = (lista: readonly SesionConRitmo[]) =>
    Math.round(lista.reduce((a, s) => a + s.fcMedia!, 0) / lista.length);

  return {
    disponible: true,
    mejoraPct,
    mejora: mejoraPct > 0,
    fcAntes: media(previas),
    fcAhora: media(recientes),
    sesiones: { antes: previas.length, ahora: recientes.length },
    fiable: comparables.length >= SESIONES_FIABLES,
    liga,
    ciencia: 'eficiencia',
  };
}

/** Ligas donde hay datos suficientes para calcular forma. Sirve para ofrecer solo esas. */
export function ligasConForma(sesiones: readonly SesionConRitmo[]): readonly IdLiga[] {
  const cuenta = new Map<IdLiga, number>();
  for (const s of sesiones) {
    if (s.ritmo == null || s.fcMedia == null) continue;
    const liga = ligaDe(s.tipo);
    if (liga == null) continue;
    cuenta.set(liga, (cuenta.get(liga) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .filter(([, n]) => n >= SESIONES_MINIMAS)
    .map(([liga]) => liga);
}
