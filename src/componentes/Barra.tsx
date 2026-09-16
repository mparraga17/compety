import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { FONDO_RGB, tema } from '../tema';

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

/** Un tramo de la columna: proporción del carril (0-1) y su color. De abajo arriba. */
export type TramoColumna = { readonly valor: number; readonly color: string };

/** Aire entre dos tramos, en puntos. Del color del fondo: son piezas de la misma columna. */
const SEPARACION = 2;

/**
 * Columna vertical del gráfico de la semana, apilada por deporte.
 *
 * ⚠️ Aparte de `Barra` y no un parámetro suyo, porque el eje cambia el problema: aquí se escala en
 * Y desde ABAJO, y el `translateY` de compensación depende de la altura en píxeles, que aquí viene
 * por parámetro porque el carril tiene alto fijo conocido.
 *
 * ⭐ Tramos (16 sep, petición del usuario): un día con varios deportes ya no es una columna lisa
 * que los suma, sino un tramo por deporte, con su tinte, separados por dos puntos de fondo. El
 * reparto de alturas lo hace Yoga con `flexGrow` proporcional a cada valor dentro de un alto
 * exacto, así que la suma de tramos más separaciones mide justo lo que mide el total. El orden y
 * los tintes los decide quien llama (`motor/apilado` y la pantalla): aquí solo se dibuja.
 *
 * ⭐ Cuerpo (regla 9d) como VELO, no como degradado del relleno: un velo del color del fondo que se
 * desvanece de la base a la punta. Sobre un solo tramo da exactamente el degradado de antes
 * (tenue abajo, pleno arriba); sobre varios, oscurece la columna entera como una pieza y los
 * tintes siguen distinguiéndose en la punta, que es donde se leen. Un degradado por tramo (se
 * probó en la maqueta) emborronaba la diferencia entre tintes.
 *
 * ⭐ Alto REAL, no escala final. Antes la columna medía el carril entero y se dejaba escalada a
 * `valor`: el remate redondo quedaba aplastado (5 pt de ancho por 5·valor de alto) y una
 * separación de 2 pt habría medido 2·valor. Ahora la columna mide lo que vale y la animación va
 * de 0 a 1, con la misma compensación anclada al suelo. Si el valor cambia (recarga con sesiones
 * nuevas), vuelve a crecer desde el suelo: es un dato nuevo, y verlo llegar es la lectura.
 */
export function Columna({
  tramos,
  alto,
  fondo = tema.color.linea,
  retardo = 0,
  ancho = '100%',
  radio = 3,
  opacidad = 1,
  cuerpo = 0.5,
}: {
  /** Tramos de abajo arriba. Se recortan para que la suma no pase de 1. Vacío = día sin nada. */
  tramos: readonly TramoColumna[];
  /** Altura del carril, en puntos. Hace falta para compensar el escalado desde el centro. */
  alto: number;
  /** Color del trazo de un día vacío. */
  fondo?: string;
  retardo?: number;
  /** Ancho dentro del carril. Al 62 % la columna tiene cuerpo sin parecer un botón. */
  ancho?: DimensionValue;
  /** Radio del remate. Con el 62 % de ancho, 5 redondea la punta sin hacerla una píldora. */
  radio?: number;
  /** Opacidad. Los días pasados van a 0,7 para que el de hoy destaque sin otro color. */
  opacidad?: number;
  /** Cuánto oscurece el velo en la base (0 = plana). 0,5 es el degradado del rediseño. */
  cuerpo?: number;
}) {
  const conPuntos = tramos.filter((tr) => tr.valor > 0);
  const total = Math.min(1, conPuntos.reduce((a, tr) => a + tr.valor, 0));
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(reducir ? 1 : 0)).current;

  useEffect(() => {
    if (reducir) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: MS.crece,
      delay: retardo,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [v, total, retardo, reducir]);

  // Una columna vacía es un trazo del color de fondo: un día sin actividad es información.
  if (total <= 0) {
    return <View style={[s.vacia, { width: ancho, backgroundColor: fondo }]} />;
  }

  const alturaReal = Math.max(SEPARACION, alto * total);
  return (
    <Animated.View
      style={[
        s.columna,
        {
          height: alturaReal,
          width: ancho,
          borderRadius: radio,
          opacity: opacidad,
          transform: [
            // ⚠️ Translate PRIMERO en la lista (capa exterior). Con el orden inverso la
            // compensación quedaba dentro del escalado y la base de la columna flotaba durante
            // la animación, aterrizando en el suelo solo al final. Mismo arreglo que en `Barra`.
            // Anclada al suelo: `t = (h/2)·(1-v)` deja el borde inferior quieto.
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [alturaReal / 2, 0],
              }),
            },
            { scaleY: v },
          ],
        },
      ]}
    >
      {conPuntos.map((tr, i) => (
        // `flexBasis: 0` para que el reparto sea proporcional a los valores y nada más. El alto
        // del contenedor está definido, así que Yoga usa la base (CalculateLayout.cpp l.101).
        <View key={i} style={{ flexGrow: tr.valor, flexBasis: 0, backgroundColor: tr.color }} />
      ))}
      {cuerpo > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              experimental_backgroundImage: `linear-gradient(to top, rgba(${FONDO_RGB},${cuerpo}) 0%, rgba(${FONDO_RGB},0) 100%)`,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pista: { overflow: 'hidden', width: '100%' as DimensionValue },
  // Ancho completo: la proporción la hace el `scaleX`, no el `width`.
  relleno: { width: '100%' as DimensionValue },
  // Los tramos se apilan de abajo arriba; el recorte redondea solo el remate de arriba y la base.
  columna: { flexDirection: 'column-reverse', gap: SEPARACION, overflow: 'hidden' },
  vacia: { height: SEPARACION, borderRadius: SEPARACION / 2 },
});
