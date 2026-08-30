import { tipoDe } from '../motor/actividades';
import { cargaMedida } from '../motor/cargaSinFc';
import { calculaZonas, maximoDeReferencia, type MaximoReferencia } from '../motor/zonas';
import {
  leerPulsosDeSesion,
  leerPulsosEntre,
  leerSesiones,
  type Sesion,
} from './lectura';

/**
 * Mide si los pulsos llegan a HealthKit con suficiente detalle.
 *
 * ⭐ Esta medida decide si el producto existe. Toda la metrica se apoya en tiempo en zonas
 * de frecuencia cardiaca, y eso solo se puede calcular si hay muestras frecuentes.
 *
 *   hueco mediano <= 5 min    viable, se puede calcular carga
 *   hueco mediano <= 15 min   justo, sirve para rankings pero no para analisis fino
 *   mas de 15 min             hay que replantear la metrica
 *
 * Nota de metodo: antes esto se iba a medir exportando el XML de la app Salud y analizandolo
 * en Windows. Medir desde la app es mejor: el XML dice lo que hay en la base de datos, la app
 * dice lo que puede LEER, y no es lo mismo.
 */

export type Veredicto = 'viable' | 'justo' | 'insuficiente' | 'sin-datos';

export type DiagnosticoSesion = {
  /** Codigo numerico de HealthKit. El nombre legible se resuelve en la interfaz. */
  tipo: number | string;
  inicio: Date;
  minutos: number;
  fuente: string;
  /** Muestras vinculadas a la sesion con el filtro { workout }. */
  muestras: number;
  /** Muestras que caen en el rango de horas de la sesion, sin exigir vinculo. */
  muestrasPorRango: number;
  huecoMediano: number | null;
  huecoMaximo: number | null;
  veredicto: Veredicto;
  /** Edwards TRIMP crudo. Crece casi lineal con el tiempo. */
  trimp: number | null;
  intensidad: number | null;
  /** Carga con volumen comprimido y factor de modalidad. Es la que puntua. */
  carga: number | null;
  minutosEnZona: number | null;
};

export type Diagnostico = {
  sesiones: number;
  sesionesConPulso: number;
  detalle: readonly DiagnosticoSesion[];
  /** Veredicto global, el peor caso razonable: la mediana de las sesiones con pulso. */
  veredicto: Veredicto;
  huecoMedianoGlobal: number | null;
  /** Fuentes que escribieron sesiones, para ver quien aporta que. */
  fuentes: readonly string[];
  /**
   * Pulsos en los ultimos 30 dias sin filtrar por sesion. Distingue el problema:
   * si aqui hay 0, el puente de la pulsera no escribe frecuencia cardiaca en absoluto.
   * Si hay muchos pero las sesiones no tienen, el problema es solo el vinculo.
   */
  pulsosEnTotal: number;
  huecoFueraDeSesion: number | null;
  /** Maximo de referencia, con aviso de si es provisional por falta de historico. */
  maximo: MaximoReferencia;
};

function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function veredictoDe(huecoMinutos: number | null, muestras: number): Veredicto {
  if (huecoMinutos === null || muestras < 2) return 'sin-datos';
  if (huecoMinutos <= 5) return 'viable';
  if (huecoMinutos <= 15) return 'justo';
  return 'insuficiente';
}

/**
 * Nombre de la app o dispositivo que escribio la sesion.
 *
 * ⚠️ Ojo: `sourceRevision.source` es un SourceProxy de nitro, no un objeto plano. Leerlo
 * directamente da "SourceProxy" en vez del nombre. Hay que bajar hasta `name`, y por si la
 * forma cambia se prueban varias rutas.
 */
function fuenteDe(sesion: Sesion): string {
  const s = sesion as unknown as {
    sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
    device?: { name?: string; manufacturer?: string };
  };
  const src = s.sourceRevision?.source;
  return (
    src?.name ??
    src?.bundleIdentifier ??
    s.device?.name ??
    s.device?.manufacturer ??
    'desconocida'
  );
}

export async function diagnostica(dias = 30, maxSesiones = 12): Promise<Diagnostico> {
  const todas = await leerSesiones(dias);

  // Las mas recientes primero, y solo las que duran algo: una sesion de 2 min no informa.
  const candidatas = [...todas]
    .filter((s) => {
      const min = (s.endDate.getTime() - s.startDate.getTime()) / 60000;
      return min >= 10;
    })
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .slice(0, maxSesiones);

  // Maximo de referencia desde el percentil 99 de 90 dias, no desde 220 menos la edad.
  // Si no hay historico suficiente sale provisional y se avisa en la interfaz.
  const hace90 = new Date();
  hace90.setDate(hace90.getDate() - 90);
  const historico = await leerPulsosEntre(hace90, new Date());
  const maximo = maximoDeReferencia(historico.map((p) => p.quantity));

  const detalle: DiagnosticoSesion[] = [];

  for (const sesion of candidatas) {
    const minutos = (sesion.endDate.getTime() - sesion.startDate.getTime()) / 60000;

    // Dos lecturas, porque distinguen dos problemas distintos:
    // por sesion exige que HealthKit vincule el pulso al entreno, por rango no.
    const porSesion = await leerPulsosDeSesion(sesion);
    const porRango = await leerPulsosEntre(sesion.startDate, sesion.endDate);

    // Se mide sobre la lectura que aporte mas datos.
    const pulsos = porSesion.length >= porRango.length ? porSesion : porRango;

    const huecos: number[] = [];
    for (let i = 1; i < pulsos.length; i++) {
      const anterior = pulsos[i - 1].endDate.getTime();
      const actual = pulsos[i].startDate.getTime();
      huecos.push((actual - anterior) / 60000);
    }

    // La prueba de fuego: calcular zonas y carga desde los pulsos crudos.
    const zonas = calculaZonas(
      pulsos.map((p) => ({ valor: p.quantity, inicio: p.startDate, fin: p.endDate })),
      maximo.valor,
    );

    // Carga con volumen comprimido, que es la cifra que de verdad puntua. El TRIMP crudo
    // crece casi lineal con el tiempo y hace que 4 h parezcan 9 veces 30 min.
    const carga =
      zonas?.intensidad != null
        ? cargaMedida({
            tipo: tipoDe(sesion.workoutActivityType) ?? '',
            minutos,
            intensidad: zonas.intensidad,
          })
        : null;

    const med = mediana(huecos);
    detalle.push({
      // Ojo: HealthKit devuelve el tipo como codigo numerico, no como texto.
      tipo: sesion.workoutActivityType ?? 'desconocido',
      inicio: sesion.startDate,
      minutos: Math.round(minutos),
      fuente: fuenteDe(sesion),
      muestras: porSesion.length,
      muestrasPorRango: porRango.length,
      huecoMediano: med === null ? null : +med.toFixed(2),
      huecoMaximo: huecos.length > 0 ? +Math.max(...huecos).toFixed(2) : null,
      veredicto: veredictoDe(med, pulsos.length),
      trimp: zonas?.trimp ?? null,
      intensidad: zonas?.intensidad ?? null,
      carga: carga?.valor ?? null,
      minutosEnZona:
        zonas === null
          ? null
          : Math.round(zonas.segundos.reduce((a, b) => a + b, 0) / 60),
    });
  }

  const conPulso = detalle.filter((d) => Math.max(d.muestras, d.muestrasPorRango) >= 2);
  const global = mediana(conPulso.map((d) => d.huecoMediano ?? 0));

  // Control independiente: ¿hay pulsos en general, aunque no esten en sesiones?
  // Esto separa "la pulsera no manda pulso" de "el pulso no esta vinculado al entreno".
  const desde = new Date();
  desde.setDate(desde.getDate() - 7);
  const sueltos = await leerPulsosEntre(desde, new Date());

  const huecosSueltos: number[] = [];
  for (let i = 1; i < sueltos.length; i++) {
    huecosSueltos.push(
      (sueltos[i].startDate.getTime() - sueltos[i - 1].endDate.getTime()) / 60000,
    );
  }
  const medSueltos = mediana(huecosSueltos);

  return {
    sesiones: todas.length,
    sesionesConPulso: conPulso.length,
    detalle,
    veredicto: veredictoDe(global, conPulso.length >= 1 ? 2 : 0),
    huecoMedianoGlobal: global === null ? null : +global.toFixed(2),
    fuentes: [...new Set(detalle.map((d) => d.fuente))],
    pulsosEnTotal: sueltos.length,
    huecoFueraDeSesion: medSueltos === null ? null : +medSueltos.toFixed(2),
    maximo,
  };
}
