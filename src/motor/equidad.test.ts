import { cargaMedida } from './cargaSinFc';
import { puntuaCarga, baseDeCarga } from './base';
import { calculaZonas } from './zonas';

/**
 * ⭐⭐ EQUIDAD: la máquina que entrena 3 h con pulso bajo contra el novato que hace 30 min
 * con el pulso por las nubes.
 *
 * Es la pregunta del usuario (7 sep): *"si una persona es una máquina y entrena 3 horas pero
 * su HR no es tan alto porque está muy en forma, que no se le penalice frente al que entrena
 * 30 min y su pulso va por las nubes porque no entrena nunca"*.
 *
 * La respuesta es que el motor YA lo resuelve, con TRES mecanismos que estos tests fijan para
 * que nadie los rompa sin enterarse:
 *
 *   1. **El máximo de referencia es PERSONAL** (percentil 99 de tus propios pulsos, no
 *      220-edad). El mismo pulso absoluto es una fracción distinta del máximo de cada uno,
 *      así que las zonas miden esfuerzo RELATIVO, no forma cardiovascular.
 *
 *   2. **El volumen manda sobre la intensidad**, y no es una opinión: en el metaanálisis de
 *      9 cohortes con acelerómetro (46.682 adultos, Am J Prev Med 2024) el volumen dio
 *      HR 0,62 y la intensidad a igual volumen HR 0,94, con intervalos que no solapan.
 *      carga = intensidad × minutos^0,65, así que 3 h de trabajo moderado pesan más que
 *      30 min a tope. La fisiología respalda a la máquina.
 *
 *   3. **Los puntos son z contra TU base.** Cada uno compite contra su propio normal, así
 *      que "fuerte para ti" vale lo mismo sea cual sea tu forma.
 */

describe('equidad: en forma contra desentrenado', () => {
  it('el mismo pulso absoluto cae en zonas distintas según el máximo PERSONAL', () => {
    // 150 lpm sostenidos durante 30 min, muestreados cada minuto.
    const muestras = Array.from({ length: 30 }, (_, i) => ({
      valor: 150,
      inicio: new Date(i * 60_000),
      fin: new Date((i + 1) * 60_000),
    }));

    // La máquina tiene máximo observado 200: 150 es el 75 %, zona 3.
    const maquina = calculaZonas(muestras, 200)!;
    // El desentrenado tiene máximo observado 160: 150 es el 94 %, zona máxima.
    const novato = calculaZonas(muestras, 160)!;

    // El novato saca MÁS intensidad del mismo pulso absoluto: su esfuerzo relativo es mayor.
    // Eso es lo justo: para él, 150 lpm es ir al límite.
    expect(novato.intensidad!).toBeGreaterThan(maquina.intensidad!);
  });

  it('3 h moderadas ganan a 30 min a tope: el volumen manda, como dice la evidencia', () => {
    // Máquina: 180 min a intensidad 2,0 (zonas 2-3 de SU máximo). No va a tope, va LARGO.
    const maquina = cargaMedida({ tipo: 'RUNNING', minutos: 180, intensidad: 2.0 });
    // Novato: 30 min a intensidad 4,0, que es el techo teórico (todo en zona máxima).
    const novato = cargaMedida({ tipo: 'RUNNING', minutos: 30, intensidad: 4.0 });

    // 2,0 × 180^0,65 ≈ 59 contra 4,0 × 30^0,65 ≈ 37. La sesión larga gana aunque su
    // intensidad sea la mitad, porque la compresión 0,65 modera el volumen pero no lo anula.
    expect(maquina.valor).toBeGreaterThan(novato.valor);
  });

  it('los puntos comparan contra la base PROPIA: fuerte para ti puntúa igual seas quien seas', () => {
    // La máquina mueve cargas de ~60 a diario; el novato, de ~35.
    const baseMaquina = baseDeCarga([55, 58, 60, 62, 61, 59, 63, 60, 57, 62]);
    const baseNovato = baseDeCarga([32, 35, 36, 34, 38, 33, 35, 37, 34, 36]);

    // Cada uno hace una sesión un ~15 % por encima de su media.
    const pMaquina = puntuaCarga(69, baseMaquina);
    const pNovato = puntuaCarga(40, baseNovato);

    // Los dos quedan por encima de 50 (su media) y a distancias comparables: el esfuerzo
    // relativo es lo que puntúa. La forma física no da ni quita ventaja de partida.
    expect(pMaquina.puntos).toBeGreaterThan(50);
    expect(pNovato.puntos).toBeGreaterThan(50);
    expect(Math.abs(pMaquina.puntos - pNovato.puntos)).toBeLessThanOrEqual(10);
  });
});
