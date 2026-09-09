import { Animated, StyleSheet, View } from 'react-native';

import { tema } from '../tema';

/**
 * Iconos de la barra de pestañas DIBUJADOS con vistas, sin fuentes ni SVG.
 *
 * ⭐ Sustituyen a los glifos unicode (✲ ≡ ☽ ♡), que eran lo que más barata hacía ver la app:
 * cuatro caracteres de una fuente de texto, con pesos y tamaños ópticos desiguales entre sí y
 * frente a la marca. Era la solución correcta cuando la alternativa costaba un módulo nativo
 * (`@expo/vector-icons` arrastra `expo-font` y un rebuild), pero hay un camino intermedio que
 * no gasta nada: geometría de Views, el mismo terreno pisado que ya usan el Medidor o las
 * barras. Rectángulos, círculos y una rotación, sin una sola dependencia.
 *
 * Cada icono representa el CONTENIDO de su pestaña, no una metáfora genérica:
 *
 *   hoy       tres columnas, el gráfico de la semana que es el corazón de esa pantalla
 *   sesiones  tres líneas, la lista del historial
 *   sueno     una luna creciente (el mordisco lo da un círculo del color del fondo,
 *             recortado por el disco: sobre la barra, que es del mismo fondo, es invisible)
 *   salud     un corazón (dos lóbulos y un cuadrado rotado, la construcción clásica)
 *
 * ⚠️ El color llega ANIMADO desde Pestanas (la interpolación tenue→marca de 200 ms), así que
 * las piezas tintadas son `Animated.View`. El mordisco de la luna NO se tinta: es fondo.
 *
 * 📌 Cuando llegue el rebuild que toque nativos, estos iconos son el sitio exacto donde
 * enchufar los SVG de la maqueta: misma caja de 21 puntos, mismo prop de color.
 */

export type IdGlifo = 'hoy' | 'sesiones' | 'sueno' | 'salud';

/** El color puede ser plano o la interpolación animada de la pestaña. */
type ColorAnimable = string | Animated.AnimatedInterpolation<string>;

type Props = {
  id: IdGlifo;
  color: ColorAnimable;
};

export function Glifo({ id, color }: Props) {
  if (id === 'hoy') {
    return (
      <View style={s.caja}>
        <View style={s.columnas}>
          <Animated.View style={[s.columna, { height: 8, backgroundColor: color }]} />
          <Animated.View style={[s.columna, { height: 14, backgroundColor: color }]} />
          <Animated.View style={[s.columna, { height: 11, backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (id === 'sesiones') {
    return (
      <View style={s.caja}>
        <View style={s.lineas}>
          <Animated.View style={[s.linea, { backgroundColor: color }]} />
          <Animated.View style={[s.linea, { backgroundColor: color }]} />
          <Animated.View style={[s.linea, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (id === 'sueno') {
    return (
      <View style={s.caja}>
        {/* El disco recorta al mordisco (overflow hidden + radio): queda la luna creciente. */}
        <View style={s.luna}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
          <View style={s.lunaMordisco} />
        </View>
      </View>
    );
  }

  // salud: el corazón clásico de dos lóbulos sobre un cuadrado rotado 45°.
  return (
    <View style={s.caja}>
      <View style={s.corazon}>
        <Animated.View style={[s.corazonCuadrado, { backgroundColor: color }]} />
        <Animated.View style={[s.corazonLobulo, s.lobuloIzq, { backgroundColor: color }]} />
        <Animated.View style={[s.corazonLobulo, s.lobuloDer, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * Caja común de 21 puntos, la misma medida que la imagen de marca de la pestaña Competi:
   * así los cinco iconos pesan lo mismo ópticamente, que era el defecto de los glifos.
   */
  caja: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },

  // hoy: el gráfico de columnas, anclado al suelo como el de verdad.
  columnas: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 14 },
  columna: { width: 3.5, borderRadius: 1.5 },

  // sesiones: la lista.
  lineas: { gap: 3 },
  linea: { width: 15, height: 2.5, borderRadius: 1.25 },

  // sueno: la luna. El mordisco es un círculo del color del fondo que el disco recorta.
  luna: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
  lunaMordisco: {
    position: 'absolute',
    left: 6,
    top: -3,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: tema.color.fondo,
  },

  // salud: el corazón. Medidas afinadas para la caja de 21; se validan en el iPhone.
  corazon: { width: 16, height: 15 },
  corazonCuadrado: {
    position: 'absolute',
    left: 4,
    top: 3.5,
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
  },
  corazonLobulo: { position: 'absolute', top: 1.5, width: 8, height: 8, borderRadius: 4 },
  lobuloIzq: { left: 1 },
  lobuloDer: { left: 7 },
});
