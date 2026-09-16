import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cristal } from './Cristal';
import { Glifo } from './Glifo';
import { IMAGEN_MARCA } from './Marca';
import { Simbolo } from './Simbolo';
import { textos } from '../i18n/textos';
import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Barra de pestañas inferior: una cápsula flotante de cristal con el contenido pasando por debajo.
 *
 * ⚠️ Faltaba por completo, y era la causa de que la app no se pareciera a la maqueta: lo que
 * habia era UNA pantalla suelta donde la maqueta tiene cinco pestañas. El usuario lo dijo
 * directo, y tenia razon: no era cuestion de retocar estilos, faltaba la estructura.
 *
 * ⭐⭐ Rediseño del 15 sep (reglas 9b y 9e de `tema.ts`):
 *
 *   - Ya NO es una franja opaca con una línea encima que se queda con 67 puntos de pantalla. Es
 *     una cápsula de cristal (`Cristal`: `GlassView` en iOS 26, desenfoque antes) que flota sobre
 *     el contenido, y el contenido deja el hueco con `paddingBottom` (ver `huecoBarra`). Es el
 *     idioma de iOS 26 y lo que hace que la app se lea como del sistema y no como una web.
 *   - Los iconos son SF Symbols (`Simbolo`), con el glifo dibujado de antes como respaldo donde
 *     no existan. Los cuatro glifos de Views eran la solución correcta cuando un módulo nativo
 *     costaba un build; con el build ya en marcha, los del sistema pesan igual que la letra.
 *   - El área segura de abajo viene de `useSafeAreaInsets`, no de un 24 fijo.
 *
 * Criterio visual de la v2 que se mantiene: la pestaña activa se marca con COLOR y peso, nunca
 * con un borde ni un fondo. Y el area tactil es de 44 puntos, que es lo que pide la guia de Apple.
 */

export type IdPestana = 'hoy' | 'competi' | 'sesiones' | 'sueno' | 'salud';

/**
 * ⭐ Competi no lleva glifo: lleva LA MARCA (la C con el rayo, decisión del usuario, 8 sep).
 * Es la pestaña correcta para la marca porque Competi es la tesis del producto. Ninguna
 * animación nueva: hereda el hundido al pulsar y el fundido de color de las demás, porque la
 * barra es lo que más se ve de la app y ahí no se anima nada.
 *
 * Las otras cuatro llevan el símbolo del sistema que representa el CONTENIDO de su pestaña, no
 * una metáfora genérica: el gráfico de la semana, el corazón, la luna, la lista.
 */
const SIMBOLO: Record<Exclude<IdPestana, 'competi'>, SFSymbol> = {
  hoy: 'chart.bar.fill',
  salud: 'heart.fill',
  sueno: 'moon.fill',
  sesiones: 'list.bullet',
};

/**
 * ⭐ Orden pedido por el usuario: Competi, Hoy, Salud, Sueño, Sesiones.
 *
 * Y tiene sentido de producto, no es solo preferencia. Competi va primera porque competir es la
 * tesis del producto y lo que trae a la gente de vuelta: el RCT de JAMA encontró que la
 * competición fue el único formato cuyo efecto persistió al apagar la gamificación.
 *
 * Sesiones cierra porque es la vista de detalle: se consulta cuando quieres entender una cifra
 * concreta, no cada vez que abres la app.
 */
const ORDEN: readonly IdPestana[] = ['competi', 'hoy', 'salud', 'sueno', 'sesiones'];

type Props = {
  activa: IdPestana;
  onCambio: (id: IdPestana) => void;
};

/** Lado del icono. La marca a la misma medida: los cinco pesan igual ópticamente. */
const LADO_ICONO = 22;

/**
 * Separación de la cápsula con el borde inferior. Con indicador de inicio (34) queda a 20, que es
 * donde iOS 26 apoya su propia barra; sin él, el mínimo del tema.
 */
export function abajoDeBarra(insetAbajo: number): number {
  return insetAbajo > 0 ? insetAbajo - 14 : tema.barra.abajoMinimo;
}

/**
 * ⭐ Hueco que el contenido de cada pestaña deja por debajo para no acabar tapado por el cristal.
 * Cada `ScrollView` lo usa como `paddingBottom`. Antes la barra era opaca y ocupaba su franja,
 * así que el contenido nunca pasaba por debajo; ahora sí, y el final de cada lista tiene que
 * poder verse entero por encima de la cápsula.
 */
export function huecoBarra(insetAbajo: number): number {
  return abajoDeBarra(insetAbajo) + tema.barra.alto + tema.barra.aireContenido;
}

/**
 * Una pestaña. Aparte para que cada una tenga su propio valor animado.
 *
 * ⭐⭐ El icono se hunde al PULSAR, no al soltar, y eso aquí importa más que en ningún otro sitio de
 * la app: cambiar de pestaña es lo que se toca más veces al día, así que es donde se nota si la
 * interfaz contesta. Apple: *"Respond on pointer-down, not on release."*
 *
 * ⛔ Y lo que NO se anima es el cambio de pantalla. Es deliberado, y sale del primer filtro de la
 * skill de Emil, la tabla de frecuencia: una acción que se repite decenas de veces al día no debe
 * animarse, porque la animación deja de leerse como fluidez y se lee como retraso. Su ejemplo es
 * Raycast, que no tiene animación de apertura precisamente por eso.
 *
 * ⇒ Lo que sí se anima es el COLOR del icono activo, un fundido de 200 ms sin desplazamiento.
 *
 * ⚠️ Un `SymbolView` no admite un color animado (`tintColor` es un prop nativo, no un estilo),
 * así que el fundido se hace apilando el símbolo en los dos colores y cruzando sus opacidades
 * con el MISMO progreso. Va por driver nativo, que es mejor que lo que había: el color de antes
 * obligaba a `useNativeDriver: false`.
 */
function Pestana({
  id,
  nombre,
  activa,
  onPress,
}: {
  id: IdPestana;
  nombre: string;
  activa: boolean;
  onPress: () => void;
}) {
  const reducir = useReducirMovimiento();
  // Progreso de "activa". Con él se cruzan las dos capas de color a la vez, así el icono y la
  // etiqueta viajan juntos en vez de saltar.
  const on = useRef(new Animated.Value(activa ? 1 : 0)).current;
  const pulso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(on, {
      toValue: activa ? 1 : 0,
      duration: MS.cambia,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [on, activa]);

  const a = (hacia: number, ms: number) =>
    Animated.timing(pulso, {
      toValue: hacia,
      duration: ms,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();

  const apagado = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const icono = (color: string) =>
    id === 'competi' ? (
      <Animated.Image
        source={IMAGEN_MARCA}
        style={[s.icono, { tintColor: color }]}
        accessible={false}
        resizeMode="contain"
      />
    ) : (
      <Simbolo
        nombre={SIMBOLO[id]}
        tamano={LADO_ICONO}
        color={color}
        peso="semibold"
        respaldoNodo={<Glifo id={id} color={color} />}
      />
    );

  return (
    <Pressable
      key={id}
      style={s.boton}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={nombre}
      onPressIn={() => a(1, MS.pulso)}
      onPressOut={() => a(0, MS.suelta)}
      onPress={onPress}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          gap: 3,
          transform: reducir
            ? []
            : [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
          opacity: reducir
            ? pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] })
            : 1,
        }}
      >
        {/* Dos capas del icono, tenue debajo y marca encima, cruzadas por el mismo progreso. */}
        <View style={s.icono}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: apagado }]}>
            {icono(tema.color.textoTenue)}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: on }]}>
            {icono(tema.color.marca)}
          </Animated.View>
        </View>
        <View style={s.etiqueta}>
          <Animated.Text style={[s.texto, { color: tema.color.textoTenue, opacity: apagado }]}>
            {nombre}
          </Animated.Text>
          <Animated.Text
            style={[s.texto, s.negrita, s.textoEncima, { color: tema.color.marca, opacity: on }]}
          >
            {nombre}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function Pestanas({ activa, onCambio }: Props) {
  const t = textos();
  const insets = useSafeAreaInsets();

  const nombres: Record<IdPestana, string> = {
    hoy: t.tabHoy,
    competi: t.competi,
    sesiones: t.tabSesiones,
    sueno: t.tabSueno,
    salud: t.tabSalud,
  };

  return (
    <View style={[s.capa, { bottom: abajoDeBarra(insets.bottom) }]} pointerEvents="box-none">
      {/* La sombra va en un envoltorio: el cristal recorta (`overflow: hidden`) y se la comería. */}
      <View style={s.sombra}>
        <Cristal radio={tema.radio.xl} style={s.capsula}>
          <View style={s.fila} accessibilityRole="tablist">
            {ORDEN.map((id) => (
              <Pestana
                key={id}
                id={id}
                nombre={nombres[id]}
                activa={id === activa}
                onPress={() => onCambio(id)}
              />
            ))}
          </View>
        </Cristal>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // La capa flota sobre el contenido: absoluta, sin fondo, y deja pasar los toques fuera de la
  // cápsula (`box-none`) para que el final de una lista siga siendo tocable a los lados.
  capa: {
    position: 'absolute',
    left: tema.barra.margen,
    right: tema.barra.margen,
    zIndex: 5,
  },
  // Sombra suave debajo: la cápsula está POR ENCIMA del contenido y tiene que leerse así.
  // Apple: *"bigger surfaces should read as thicker: stronger blur + a deeper shadow"*.
  sombra: {
    borderRadius: tema.radio.xl,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  capsula: { height: tema.barra.alto },
  fila: { flex: 1, flexDirection: 'row' },
  boton: {
    flex: 1,
    minHeight: tema.tactil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icono: { width: LADO_ICONO, height: LADO_ICONO },
  etiqueta: { alignItems: 'center' },
  texto: { fontSize: 10 },
  negrita: { fontWeight: '600' },
  // La etiqueta de marca va encima de la tenue, en la misma caja. La negrita es un pelo más
  // ancha, así que centrada se solapa sin que se note el cambio de peso durante el fundido.
  textoEncima: { position: 'absolute', top: 0 },
});
