import { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from './Avatar';
import { Pulsable } from './Pulsable';
import { useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Cabecera grande de pestana, el "large title" de iOS, y su version compacta al hacer scroll.
 *
 * ⭐ Rediseno del 15 sep (regla 9a de `tema.ts`). Las cuatro pestanas de datos abrian con una
 * etiqueta de 15 px tenue, asi que ninguna respondia "donde estoy" con claridad (regla 5) y
 * ninguna tenia camino al perfil: solo Competi llevaba avatar. Ahora las cinco abren igual:
 *
 *   linea de contexto  (`sub`, en suave: la fecha, la ventana, la noche)
 *   TITULO             (`tituloGrande`, 28/700)                        [avatar → perfil]
 *
 * Y al hacer scroll el titulo grande se va con el contenido y aparece la barra compacta
 * (`BarraCompacta`): titulo de 17 sobre un borde de scroll en DEGRADADO, no una linea. Apple:
 * *"scroll edge effects, not hard dividers"*. Va atada al scroll con `Animated.event` y driver
 * nativo, asi que es 1:1 con el dedo e interrumpible por construccion: no hay animacion que
 * esperar, hay una posicion.
 *
 * ⚠️ El contexto va en `textoSuave` y no en `textoTenue` a proposito: es la linea que cae sobre
 * la parte mas clara del halo, y ahi el tenue se quedaba en ~4,2:1 (medido con la formula de
 * luminancia de WCAG); el suave pasa de 5:1.
 *
 * La cabecera se pinta DENTRO del scroll (se va con el contenido) y la barra compacta FUERA,
 * absoluta arriba. Las dos se coordinan con el mismo `Animated.Value` que devuelve
 * `useScrollCabecera`.
 */

/** Desplazamiento a partir del cual la barra compacta empieza a aparecer, y donde ya esta entera. */
const UMBRAL_INICIO = 44;
const UMBRAL_FIN = 76;

/** Alto de la franja de la barra compacta por debajo del area segura. La de iOS. */
const ALTO_BARRA = 44;

export type PerfilCabecera = {
  /** Nombre de la persona, para el tono del avatar. */
  nombre: string;
  /** Inicial ya resuelta. */
  inicial: string;
};

type Props = {
  titulo: string;
  /** Linea de contexto encima del titulo: la fecha, la ventana temporal, la ultima noche. */
  contexto?: string;
  perfil?: PerfilCabecera | null;
  onPerfil?: () => void;
  etiquetaPerfil?: string;
};

/**
 * Valor de scroll y el `onScroll` que lo alimenta. El driver nativo mueve la barra compacta
 * sin pasar por el hilo de JavaScript, que es donde el motor esta recalculando.
 */
export function useScrollCabecera() {
  const y = useRef(new Animated.Value(0)).current;
  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true }),
  ).current;
  return { y, onScroll };
}

export function Cabecera({ titulo, contexto, perfil, onPerfil, etiquetaPerfil }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.cabecera, { paddingTop: insets.top + tema.espacio.m }]}>
      <View style={s.textos}>
        {contexto !== undefined && <Text style={s.contexto}>{contexto}</Text>}
        <Text style={s.titulo} accessibilityRole="header">
          {titulo}
        </Text>
      </View>
      {perfil !== undefined && perfil !== null && onPerfil !== undefined && (
        <Pulsable
          onPress={onPerfil}
          style={s.perfil}
          accessibilityRole="button"
          accessibilityLabel={etiquetaPerfil ?? perfil.nombre}
        >
          <Avatar nombre={perfil.nombre} inicial={perfil.inicial} esYo tamano={36} />
        </Pulsable>
      )}
    </View>
  );
}

/**
 * La barra compacta que aparece al hacer scroll. Va ABSOLUTA arriba, fuera del scroll.
 *
 * El fondo es un degradado del color de fondo a transparente: el contenido se funde por debajo
 * en vez de cortarse contra una linea. Con movimiento reducido la opacidad se queda (no es
 * movimiento, es posicion) y solo se quita el pequeno desplazamiento del titulo.
 */
export function BarraCompacta({ titulo, y }: { titulo: string; y: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const reducir = useReducirMovimiento();
  const opacidad = y.interpolate({
    inputRange: [UMBRAL_INICIO, UMBRAL_FIN],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Franja solida hasta el final de la barra, y 28 pt mas de fundido hacia el contenido.
  const solido = insets.top + ALTO_BARRA;
  const total = solido + 28;

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.compacta, { height: total, opacity: opacidad }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `linear-gradient(to bottom, ${tema.color.fondo} 0%, ${tema.color.fondo} ${Math.round((solido / total) * 100)}%, rgba(20,21,26,0) 100%)`,
          },
        ]}
      />
      <Animated.Text
        style={[
          s.tituloCompacto,
          { top: insets.top + 11 },
          !reducir && {
            transform: [
              {
                translateY: y.interpolate({
                  inputRange: [UMBRAL_INICIO, UMBRAL_FIN],
                  outputRange: [6, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        {titulo}
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: tema.espacio.s,
  },
  textos: { flex: 1, minWidth: 0 },
  contexto: { ...tema.tipo.sub, color: tema.color.textoSuave },
  titulo: { ...tema.tipo.tituloGrande, color: tema.color.texto, marginTop: 2 },
  // El avatar cae al final de la linea del titulo, con la misma base optica.
  perfil: { marginLeft: tema.espacio.m, marginBottom: 4 },
  compacta: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 },
  tituloCompacto: {
    ...tema.tipo.tituloCompacto,
    color: tema.color.texto,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
