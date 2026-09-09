import { StyleSheet, Text, View } from 'react-native';

import { Aparece } from './Aparece';
import { ESCALON } from '../movimiento';
import { tema } from '../tema';

/**
 * Cifra protagonista con una barra de progreso segmentada debajo.
 *
 * ⛔⛔ SUSTITUYE AL ANILLO COPIADO DE WHOOP, y el usuario fue claro: *"las letras se salen del
 * círculo, no podemos copiar a Whoop, busca otra forma"*. Tenía razón por tres motivos, y solo uno
 * era estético:
 *
 *   1. **El texto no cabe.** Dentro de un círculo el ancho útil es el diámetro menos el grosor del
 *      anillo por dos. Con "EQUIVALENT MODERATE MIN" y un número de tres cifras, no hay hueco. Un
 *      contenedor circular es hostil al texto por geometría, no por diseño.
 *   2. ⭐ **El medidor no medía nada.** En la captura marcaba 412 sobre un objetivo de 150, así que
 *      el anillo estaba lleno y clavado al máximo. Un indicador que siempre marca lo mismo es peor
 *      que ninguno: ocupa el sitio del protagonista y no informa.
 *   3. **Copiar a Whoop no nos deja sitio propio.** Su anillo es su marca. Usarlo nos hace parecer
 *      una imitación peor, no una alternativa.
 *
 * ⇒ Forma elegida: la cifra manda por TAMAÑO (que es la regla de la v2 del panel, jerarquía por
 * tipografía y no por cajas) y debajo va una barra segmentada que sí soporta pasarse del objetivo:
 * los segmentos extra se marcan aparte en vez de saturar.
 *
 * 📌 Y encaja con la skill de Apple: *"build hierarchy from weight + size + leading as a set, not
 * size alone"*. El texto va en línea, donde el ancho es todo el de la pantalla.
 */

type Props = {
  /** La cifra grande. */
  valor: string;
  /** Qué es la cifra. Va debajo, en una línea, con todo el ancho disponible. */
  etiqueta: string;
  /**
   * Progreso hacia el objetivo. Puede pasar de 1 y se muestra el exceso, en vez de saturar.
   * null cuando no hay objetivo que medir: entonces solo va la cifra.
   */
  progreso?: number | null;
  /** Frase que sitúa la cifra. Es lo que hace legible el número. */
  frase?: string;
  color?: string;
};

/** Segmentos de la barra. Cada uno es una fracción del objetivo. */
const SEGMENTOS = 10;

export function Medidor({ valor, etiqueta, progreso = null, frase, color = tema.color.marca }: Props) {
  // Se separa el progreso hasta el objetivo del exceso, para poder pintarlos distinto.
  const hasta = progreso === null ? 0 : Math.max(0, Math.min(1, progreso));
  const exceso = progreso === null ? 0 : Math.max(0, progreso - 1);

  const llenos = Math.round(hasta * SEGMENTOS);

  return (
    <View style={s.caja}>
      <View style={s.fila}>
        <Text style={s.valor}>{valor}</Text>
        <Text style={s.etiqueta}>{etiqueta}</Text>
      </View>

      {progreso !== null && (
        <>
          <View style={s.barra}>
            {Array.from({ length: SEGMENTOS }, (_, i) => {
              const lleno = i < llenos;
              return (
                <View
                  key={i}
                  style={[
                    s.segmento,
                    // El primer segmento y el último redondean solo por su lado, así la barra
                    // completa se lee como una pieza y no como diez cajas sueltas.
                    i === 0 && s.segmentoIzq,
                    i === SEGMENTOS - 1 && s.segmentoDer,
                  ]}
                >
                  {/*
                    ⭐ Los segmentos llenos se ENCIENDEN uno detrás de otro, de izquierda a derecha.
                
                    Aquí la cascada es literalmente el dato: la barra cuenta cuánto llevas del
                    objetivo, y verla llenarse comunica el progreso mejor que verla ya llena, que es
                    un estado sin recorrido. Con un escalón por segmento el llenado completo tarda
                    lo mismo que una barra sola, porque los retardos se solapan.
                  
                    ⚠️ El relleno va DENTRO del segmento, en absoluto, en vez de cambiarle el color
                    al propio segmento: así se puede animar la opacidad sin tocar el hueco de la
                    barra vacía, que tiene que seguir viéndose debajo.
                  */}
                  {lleno && (
                    <Aparece
                      retardo={i * (ESCALON / 2)}
                      desde={0}
                      style={[s.relleno, { backgroundColor: color }]}
                    >
                      <View />
                    </Aparece>
                  )}
                </View>
              );
            })}
          </View>

          {/*
            ⭐ El exceso se DICE, no se dibuja. Es lo que arregla el caso de la captura: con 412
            sobre 150, "has hecho 2,7 veces el objetivo" informa y una barra llena no.
          */}
          {exceso > 0 && (
            <Text style={s.exceso}>{`×${(1 + exceso).toFixed(1).replace('.', ',')}`}</Text>
          )}
        </>
      )}

      {frase !== undefined && <Text style={s.frase}>{frase}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { paddingVertical: tema.espacio.m, gap: 10 },
  // Cifra y etiqueta en línea, con la etiqueta alineada a la base del número.
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  valor: { ...tema.tipo.cifra, color: tema.color.texto },
  etiqueta: {
    ...tema.tipo.micro,
    color: tema.color.textoSuave,
    letterSpacing: 0.4,
    flex: 1,
    // Baja la etiqueta para que su línea base coincida con la del número.
    paddingBottom: 10,
  },
  barra: { flexDirection: 'row', gap: 3, height: 4 },
  // `overflow: hidden` para que el relleno de dentro respete el redondeo de los extremos.
  segmento: { flex: 1, backgroundColor: tema.color.linea, borderRadius: 1, overflow: 'hidden' },
  segmentoIzq: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  segmentoDer: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  // Cubre el segmento entero: es el color encendido, y su aparición es lo que se anima.
  relleno: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  exceso: { ...tema.tipo.micro, color: tema.color.marca, ...tema.cifras },
  frase: { fontSize: 14, lineHeight: 20, color: tema.color.texto },
});
