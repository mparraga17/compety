import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ReturnKeyTypeOptions,
} from 'react-native';

import { Pulsable } from './Pulsable';
import {
  canonicaliza,
  claveDeCiudad,
  filtraOpciones,
  parteCoincidente,
} from '../datos/distritos';
import { conValores, textos } from '../i18n/textos';
import { CURVA, MS, useReducirMovimiento } from '../movimiento';
import { tema } from '../tema';

/**
 * Campo que busca y escribe a la vez: el combobox de ciudad y distrito.
 *
 * ⭐ Sustituye al par desplegable + «Otro…» (petición del usuario, 8 sep: "una opción de
 * buscar y que se vayan desplegando en función de las letras introducidas y si no se
 * encuentra introducir manualmente"). Un solo campo hace los tres trabajos:
 *
 *   hojear    con el campo vacío y el foco puesto, la lista entera debajo
 *   buscar    cada letra filtra por clave normalizada (cha → Chamartín, Chamberí)
 *   escribir  si no hay coincidencia, lo tecleado vale: la fila «Usar "X"» lo dice
 *
 * La fila «Usar…» viene del patrón `addCustomItem` de react-native-dropdown-picker
 * (verificado con el GitHub MCP): cuando lo buscado no casa exacto con ninguna opción, se
 * añade una fila con el texto crudo. Comunica que la entrada manual existe, que era lo que
 * el desplegable con «Otro…» escondía a dos toques.
 *
 * ⚠️ Las sugerencias EMPUJAN el contenido, no flotan. La alternativa (lista en absolute,
 * como react-native-autocomplete-input) arrastra los líos de zIndex en iOS que su propio
 * código parchea con `Platform.select`. Empujar es lo que hace la búsqueda de Ajustes de
 * iOS, y dentro de nuestro ScrollView no rompe nada.
 *
 * ⚠️ El ScrollView interno lleva su propio `keyboardShouldPersistTaps`: sin él, el primer
 * toque en una sugerencia solo cierra el teclado. Es el mismo arreglo que ya llevaba la
 * pantalla entera, aplicado a la lista anidada (dos ScrollView verticales anidados
 * funcionan en iOS de serie).
 */

type Props = {
  /** Para el lector de pantalla y para el título de la lista. */
  etiqueta: string;
  valor: string;
  onCambio: (texto: string) => void;
  /** Opciones ya fusionadas (catálogo + servidor), con su grafía oficial. */
  opciones: readonly string[];
  placeholder: string;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
};

/** 5 filas y media: la media fila asoma y dice que la lista sigue hacia abajo. */
const ALTO_LISTA = 5.5 * tema.tactil;

export function Buscador({
  etiqueta,
  valor,
  onCambio,
  opciones,
  placeholder,
  returnKeyType = 'done',
  onSubmitEditing,
}: Props) {
  const t = textos();
  const [enfoque, setEnfoque] = useState(false);
  const reducir = useReducirMovimiento();
  const aparicion = useRef(new Animated.Value(0)).current;

  const filtradas = filtraOpciones(valor, opciones);
  const limpio = valor.trim();
  /** ¿Lo tecleado ya es una opción? Por clave normalizada, no por igualdad literal. */
  const enLista =
    limpio !== '' && opciones.some((o) => claveDeCiudad(o) === claveDeCiudad(limpio));
  const abierta = enfoque && (filtradas.length > 0 || (limpio !== '' && !enLista));

  /**
   * La lista se despliega DESDE el campo (opacidad + un translate corto hacia abajo): es el
   * "anchor to the source" de la skill de Apple, la misma razón del giro del chevron del
   * Selector. Se anima solo el abrir; el filtrado por letra no se anima nunca, porque pasa
   * decenas de veces por búsqueda y es la regla de "no animar lo que se ve mucho". El
   * cierre es instantáneo: al cerrar ya has decidido, y la salida nunca es más lenta que
   * la entrada.
   */
  useEffect(() => {
    if (!abierta) {
      aparicion.setValue(0);
      return;
    }
    if (reducir) {
      aparicion.setValue(1);
      return;
    }
    Animated.timing(aparicion, {
      toValue: 1,
      duration: MS.cambia,
      easing: CURVA.sale,
      useNativeDriver: true,
    }).start();
  }, [abierta, aparicion, reducir]);

  function elegir(texto: string) {
    onCambio(texto);
    Keyboard.dismiss();
  }

  return (
    <>
      <TextInput
        style={s.campo}
        value={valor}
        onChangeText={onCambio}
        placeholder={placeholder}
        placeholderTextColor={tema.color.textoTenue}
        maxLength={40}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onFocus={() => setEnfoque(true)}
        onBlur={() => {
          setEnfoque(false);
          // Al terminar de escribir, «chamberi» adopta el «Chamberí» de la lista. Nunca en
          // mitad de la escritura: reescribir bajo los dedos mueve el cursor y pelea contigo.
          const oficial = canonicaliza(valor, opciones);
          if (oficial !== valor) onCambio(oficial);
        }}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={etiqueta}
      />

      {abierta && (
        <Animated.View
          style={{
            opacity: aparicion,
            transform: reducir
              ? []
              : [
                  {
                    translateY: aparicion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 0],
                    }),
                  },
                ],
          }}
        >
          <ScrollView
            style={s.lista}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            accessibilityLabel={etiqueta}
          >
            {filtradas.map((opcion) => {
              const trozos = parteCoincidente(opcion, valor);
              return (
                <Pulsable
                  key={opcion}
                  style={s.fila}
                  onPress={() => elegir(opcion)}
                  accessibilityRole="button"
                  accessibilityLabel={opcion}
                >
                  {/* La coincidencia en tinta plena y el resto suave: la jerarquía la hace
                      el color del texto, no un fondo ni un borde. Regla de la v2. */}
                  {trozos === null ? (
                    <Text style={s.texto}>{opcion}</Text>
                  ) : (
                    <Text style={s.texto} numberOfLines={1}>
                      {trozos.antes}
                      <Text style={s.coincide}>{trozos.medio}</Text>
                      {trozos.despues}
                    </Text>
                  )}
                </Pulsable>
              );
            })}

            {/* ⭐ La entrada manual, explícita: si lo tecleado no está, se usa tal cual. */}
            {limpio !== '' && !enLista && (
              <Pulsable
                style={s.fila}
                onPress={() => elegir(limpio)}
                accessibilityRole="button"
                accessibilityLabel={conValores(t.usarTexto, { texto: limpio })}
              >
                <Text style={s.usar} numberOfLines={1}>
                  {conValores(t.usarTexto, { texto: limpio })}
                </Text>
              </Pulsable>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  // Idéntico al `campo` de Zona y NuevaLiga: mismo aspecto = mismo comportamiento.
  campo: {
    ...tema.tipo.cuerpo,
    minHeight: tema.tactil,
    color: tema.color.texto,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.m,
    paddingHorizontal: tema.espacio.m,
    paddingVertical: tema.espacio.m,
  },
  // La lista cuelga del campo con el fondo sutil de los controles. Sin bordes: la separa
  // la diferencia de luminosidad, como al selector.
  lista: {
    maxHeight: ALTO_LISTA,
    backgroundColor: tema.color.superficieSutil,
    borderRadius: tema.radio.m,
    marginTop: tema.espacio.xs,
  },
  fila: {
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.m,
  },
  texto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  coincide: { color: tema.color.texto, fontWeight: '600' },
  usar: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '500' },
});
