import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Barra de proporción que CRECE hasta su valor.
 *
 * ⭐ Existe porque el mismo trozo estaba escrito tres veces con medidas distintas: la pista de
 * cada fila de la clasificación, las columnas del gráfico de Hoy y los segmentos del medidor. Y
 * eso es exactamente lo que hace que una interfaz se sienta descuidada, que es la lección que este
 * proyecto lleva repitiendo con la hoja modal y el tirador.
 *
 * ⭐ Por qué SÍ merece animarse, aplicando el filtro de Emil (*"Every animation must have a clear
 * answer to 'why does this animate?'"*): la barra es una comparación, y verla llegar a su sitio
 * dice de un vistazo quién va por delante. No es adorno, es la lectura del dato. Es de las pocas
 * animaciones de la app que puede pasar de 300 ms, y por eso `MS.crece` son 480.
 *
 * ⚠️ Va con `scaleX` y NO con `width`. Es la regla de rendimiento de la skill: *"Only animate
 * transform and opacity. These properties skip layout and paint, running on the GPU."* Animar
 * `width` recalcularía el layout en cada fotograma, y con siete filas a la vez eso son fotogramas
 * perdidos justo al abrir la pantalla.
 *
 * ⛔⛔ DOS BUGS CORREGIDOS en la compensación del `scaleX`, que escala desde el CENTRO:
 *
 *   1. El translate iba en PUNTOS fijos (`-0.5`) en vez de la mitad del ancho real. Con eso la
 *      barra crecía desde el centro de la pista, no anclada a la izquierda. El ancho se mide con
 *      `onLayout`, igual que `Columna` recibe su alto: la compensación necesita píxeles reales.
 *
 *   2. El ORDEN de los transforms estaba al revés. En React Native el ÚLTIMO de la lista se
 *      aplica primero al elemento (es la receta conocida de la órbita: `[{rotate}, {translateX}]`
 *      traslada primero y rota después). Con `[{scaleX}, {translateX}]` la traslación quedaba
 *      DENTRO del escalado, así que se encogía con él y la barra derrapaba durante la animación,
 *      aterrizando bien solo en el último fotograma. El translate va primero en la lista (capa
 *      exterior) y así la compensación es lineal y exacta en todo el recorrido:
 *      con el borde izquierdo en -ancho/2 desde el centro, `t = (ancho/2)·(1-v)` lo deja clavado.
 */

type Props = {
  /** Proporción de 0 a 1. Se recorta, así que un valor fuera de rango no rompe el dibujo. */
  valor: number;
  color?: string;
  /** Grosor. 2 en las filas de la clasificación, 4 en el medidor. */
  alto?: number;
  fondo?: string;
  /** Retardo de entrada, para escalonar una lista. */
  retardo?: number;
  /**
   * Degradado opcional del relleno, de izquierda a derecha: `[desde, hasta]`. Manda sobre
   * `color`.
   *
   * ⭐ Existe para el BRILLO de las barras del podio: un metal plano a todo lo largo pesa, y el
   * degradado de tenue a pleno lo convierte en un destello que apunta a la punta de la barra,
   * que es donde está el dato. Va con el `linear-gradient` del core (mismo mecanismo que el
   * `radial-gradient` del Halo) y en sintaxis vanilla, que es la lección de esa API: lo exótico
   * se rechaza en silencio en la capa nativa.
   */
  degradado?: readonly [string, string];
};

export function Barra({
  valor,
  color = tema.color.marca,
  alto = 2,
  fondo = tema.color.superficieSutil,
  retardo = 0,
  degradado,
}: Props) {
  const destino = Math.max(0, Math.min(1, valor));
  const reducir = useReducirMovimiento();
  // Ancho real de la pista, medido. Sin él no se puede compensar el escalado desde el centro.
  const [ancho, setAncho] = useState<number | null>(null);
  // Arranca en 0 para que se vea crecer. Es el único caso de la app donde eso aporta: la barra
  // ES la comparación, así que el recorrido informa.
  const v = useRef(new Animated.Value(reducir ? destino : 0)).current;

  useEffect(() => {
    // Hasta conocer el ancho no hay animación que valga: la compensación saldría mal.
    if (ancho === null) return;
    if (reducir) {
      v.setValue(destino);
      return;
    }
    Animated.timing(v, {
      toValue: destino,
      duration: MS.crece,
      delay: retardo,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [v, destino, retardo, reducir, ancho]);

  return (
    <View
      style={[s.pista, { height: alto, backgroundColor: fondo, borderRadius: alto / 2 }]}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
    >
      {ancho !== null && (
        <Animated.View
          style={[
            s.relleno,
            // El degradado compone el relleno entero, así que al escalar viaja con la barra.
            degradado === undefined
              ? { backgroundColor: color }
              : {
                  experimental_backgroundImage: `linear-gradient(to right, ${degradado[0]} 0%, ${degradado[1]} 100%)`,
                },
            {
              height: alto,
              borderRadius: alto / 2,
              transform: [
                // Primero en la lista = capa EXTERIOR: la traslación no se escala con la barra.
                // Compensa que `scaleX` escala desde el centro: ancla el borde izquierdo.
                {
                  translateX: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-ancho / 2, 0],
                  }),
                },
                { scaleX: v },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

/**
 * Columna vertical del gráfico de la semana.
 *
 * ⚠️ Aparte de `Barra` y no un parámetro suyo, porque el eje cambia el problema: aquí se escala en
 * Y desde ABAJO, y el `translateY` de compensación depende de la altura en píxeles, que aquí viene
 * por parámetro porque el carril tiene alto fijo conocido.
 */
export function Columna({
  valor,
  alto,
  color = tema.color.marca,
  fondo = tema.color.linea,
  retardo = 0,
  degradado,
  ancho = '100%',
  radio = 3,
  opacidad = 1,
}: {
  valor: number;
  /** Altura del carril, en puntos. Hace falta para compensar el escalado desde el centro. */
  alto: number;
  color?: string;
  fondo?: string;
  retardo?: number;
  /**
   * Degradado vertical del relleno, `[abajo, arriba]`. Manda sobre `color`.
   *
   * ⭐ Rediseño del 15 sep (regla 9d): una columna plana de un solo color se lee como un bloque;
   * de tenue en la base a pleno en la punta se lee como una barra con cuerpo, y la punta, que es
   * donde está el dato, es lo que más brilla. Mismo mecanismo que el brillo del podio.
   */
  degradado?: readonly [string, string];
  /** Ancho dentro del carril. Al 62 % la columna tiene cuerpo sin parecer un botón. */
  ancho?: DimensionValue;
  /** Radio del remate. Con el 62 % de ancho, 5 redondea la punta sin hacerla una píldora. */
  radio?: number;
  /** Opacidad. Los días pasados van a 0,7 para que el de hoy destaque sin otro color. */
  opacidad?: number;
}) {
  const destino = Math.max(0.02, Math.min(1, valor));
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(reducir ? destino : 0)).current;

  useEffect(() => {
    if (reducir) {
      v.setValue(destino);
      return;
    }
    Animated.timing(v, {
      toValue: destino,
      duration: MS.crece,
      delay: retardo,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [v, destino, retardo, reducir]);

  const vacia = valor <= 0;
  return (
    <Animated.View
      style={[
        s.columna,
        // El degradado compone el relleno entero, así que al escalar viaja con la columna. Una
        // columna vacía es un trazo del color de fondo: un día sin actividad es información.
        vacia || degradado === undefined
          ? { backgroundColor: vacia ? fondo : color }
          : {
              experimental_backgroundImage: `linear-gradient(to top, ${degradado[0]} 0%, ${degradado[1]} 100%)`,
            },
        {
          height: alto,
          width: ancho,
          borderRadius: radio,
          opacity: vacia ? 1 : opacidad,
          transform: [
            // ⚠️ Translate PRIMERO en la lista (capa exterior). Con el orden inverso la
            // compensación quedaba dentro del escalado y la base de la columna flotaba durante
            // la animación, aterrizando en el suelo solo al final. Mismo arreglo que en `Barra`.
            // Anclada al suelo: `t = (alto/2)·(1-v)` deja el borde inferior quieto.
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [alto / 2, 0],
              }),
            },
            { scaleY: v },
          ],
        },
      ]}
    />
  );
}

const s = StyleSheet.create({
  pista: { overflow: 'hidden', width: '100%' as DimensionValue },
  // Ancho completo: la proporción la hace el `scaleX`, no el `width`.
  relleno: { width: '100%' as DimensionValue },
  // Ancho y radio los pone cada uso: el gráfico de la semana al 62 %, el resto a todo el carril.
  columna: {},
});
