import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Glifo } from './Glifo';
import { IMAGEN_MARCA } from './Marca';
import { textos } from '../i18n/textos';
import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Barra de pestañas inferior.
 *
 * ⚠️ Faltaba por completo, y era la causa de que la app no se pareciera a la maqueta: lo que
 * habia era UNA pantalla suelta donde la maqueta tiene cinco pestañas. El usuario lo dijo
 * directo, y tenia razon: no era cuestion de retocar estilos, faltaba la estructura.
 *
 * ⭐ Sin libreria de iconos, y es decision consciente. `@expo/vector-icons` es un modulo nativo
 * y arrastra `expo-font`, que en el LEARNINGS.md de LeonApostolico esta apuntada como trampa
 * (`Cannot find native module 'ExpoFontLoader'`). Anadirlo obligaria a recompilar y a gastar uno
 * de los 15 builds de iOS al mes. Se usa un glifo por pestaña, que se lee igual.
 * 📌 Cambiar por los SVG de la maqueta en el proximo rebuild que toque nativos.
 *
 * Criterio visual de la v2: la pestaña activa se marca con COLOR y peso, nunca con un borde ni
 * un fondo. Y el area tactil es de 44 puntos, que es lo que pide la guia de Apple.
 */

export type IdPestana = 'hoy' | 'competi' | 'sesiones' | 'sueno' | 'salud';

/**
 * ⭐ Competi no lleva glifo: lleva LA MARCA (la C con el rayo, decisión del usuario, 8 sep).
 * Es la pestaña correcta para la marca porque Competi es la tesis del producto. Ninguna
 * animación nueva: hereda el hundido al pulsar y el fundido de color de las demás, porque la
 * barra es lo que más se ve de la app y ahí no se anima nada.
 *
 * ⭐ Las otras cuatro llevan iconos DIBUJADOS (`Glifo`), que sustituyen a los caracteres
 * unicode ✲ ≡ ☽ ♡: cuatro glifos de fuente con pesos ópticos desiguales eran lo que más
 * barata hacía ver la barra. Siguen sin costar ningún módulo nativo.
 */

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

/**
 * Una pestaña. Aparte para que cada una tenga su propio valor animado.
 *
 * ⭐⭐ El glifo se hunde al PULSAR, no al soltar, y eso aquí importa más que en ningún otro sitio de
 * la app: cambiar de pestaña es lo que se toca más veces al día, así que es donde se nota si la
 * interfaz contesta. Apple: *"Respond on pointer-down, not on release."*
 *
 * ⛔ Y lo que NO se anima es el cambio de pantalla. Es deliberado, y sale del primer filtro de la
 * skill de Emil, la tabla de frecuencia: una acción que se repite decenas de veces al día no debe
 * animarse, porque la animación deja de leerse como fluidez y se lee como retraso. Su ejemplo es
 * Raycast, que no tiene animación de apertura precisamente por eso.
 *
 * ⇒ Lo que sí se anima es el COLOR del icono activo, que es un fundido de 200 ms sin
 * desplazamiento: informa del cambio de estado y no retrasa nada, porque la pantalla nueva ya está
 * pintada mientras el color viaja.
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
  // Progreso de "activa". Con él se interpolan color y opacidad a la vez, así el icono y la
  // etiqueta viajan juntos en vez de saltar.
  const on = useRef(new Animated.Value(activa ? 1 : 0)).current;
  const pulso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(on, {
      toValue: activa ? 1 : 0,
      duration: MS.cambia,
      easing: CURVA.sale,
      // ⚠️ `false` obligado: `color` no lo sabe interpolar el driver nativo. Es aceptable aquí y
      // solo aquí, porque son dos valores y ningún desplazamiento, así que un fotograma perdido
      // no se ve. El hundido de al lado sí va por driver nativo.
      useNativeDriver: false,
    }).start();
  }, [on, activa]);

  const color = on.interpolate({
    inputRange: [0, 1],
    outputRange: [tema.color.textoTenue, tema.color.marca],
  });

  const a = (hacia: number, ms: number) =>
    Animated.timing(pulso, {
      toValue: hacia,
      duration: ms,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();

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
          gap: 2,
          transform: reducir
            ? []
            : [{ scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
          opacity: reducir
            ? pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] })
            : 1,
        }}
      >
        {id === 'competi' ? (
          // La marca tintada con el MISMO progreso que el color de los glifos: icono y
          // etiqueta viajan juntos, y la pestaña de la marca no se comporta distinto.
          <Animated.Image
            source={IMAGEN_MARCA}
            style={[s.marca, { tintColor: color }]}
            accessible={false}
            resizeMode="contain"
          />
        ) : (
          // El icono dibujado recibe el MISMO color animado que la etiqueta: viajan juntos.
          <Glifo id={id} color={color} />
        )}
        <Animated.Text style={[s.texto, { color }, activa && s.negrita]}>{nombre}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function Pestanas({ activa, onCambio }: Props) {
  const t = textos();

  const nombres: Record<IdPestana, string> = {
    hoy: t.tabHoy,
    competi: t.competi,
    sesiones: t.tabSesiones,
    sueno: t.tabSueno,
    salud: t.tabSalud,
  };

  return (
    <View style={s.barra}>
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
  );
}

const s = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    // Linea de un pixel, no un bloque de color: la barra tiene que desaparecer visualmente.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
    backgroundColor: tema.color.fondo,
    // Hueco para el indicador de inicio del iPhone.
    paddingBottom: tema.espacio.l,
    paddingTop: tema.espacio.s,
  },
  boton: {
    flex: 1,
    minHeight: tema.tactil,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // La marca a 21, la misma caja que los iconos dibujados: los cinco pesan igual ópticamente.
  marca: { width: 21, height: 21 },
  texto: { fontSize: 10 },
  negrita: { fontWeight: '600' },
});
