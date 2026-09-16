import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Hoja, estilosHoja } from './Hoja';
import { Pulsable } from './Pulsable';
import { Simbolo } from './Simbolo';
import { fichaDe, hayFicha, type ClaveCiencia } from '../motor/ciencia';
import { conValores, idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Botón "En qué nos basamos" y la hoja que abre.
 *
 * ⭐ Por qué es un botón al final y no fichas repartidas por la vista. Lo pidió el usuario el
 * 26 ago: *"lo de cómo funciona debería ser un botón que esté al final del todo"*. Antes cada
 * regla llevaba su ficha pegada al lado, y eso convertía pantallas que deben leerse de un
 * vistazo en muros de texto. La información no se pierde, se agrupa.
 *
 * Y hay motivo de producto, no solo de espacio: el estudio JAMIA 2023 con 18 usuarios reales de
 * Fitbit señala los scores opacos como el mayor problema de confianza de estas apps. Cada
 * puntuación tiene que poder justificarse, así que cada pestaña declara sus fuentes.
 *
 * ⚠️ Las fichas viven en `motor/ciencia.ts`, no aquí. El texto va con la regla que lo sostiene,
 * de modo que si alguien cambia la fórmula ve la fuente que está tocando.
 */

type Props = {
  /** Fuentes de esta pestaña, en el orden en que se quieren leer. */
  ids: readonly ClaveCiencia[];
};

export function Ciencia({ ids }: Props) {
  const [abierta, setAbierta] = useState(false);
  // ⚠️ El idioma se lee aquí y se pasa a `fichaDe`. Era el bug que vio el usuario: las fichas
  // estaban escritas solo en español, así que la hoja salía en español con la app en inglés.
  const idioma = idiomaActual();
  const t = textos(idioma);

  // Se filtran las que existen: así una pestaña puede pedir una ficha que aún no está portada
  // sin romper nada ni mostrar un hueco.
  const fichas = ids.filter(hayFicha);
  if (fichas.length === 0) return null;

  return (
    <>
      <Pulsable
        style={s.boton}
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel={t.enQueNosBasamos}
      >
        {/* La "i" del sistema. Antes un círculo dibujado con vistas, de cuando un módulo nativo
            costaba un build. */}
        <Simbolo nombre="info.circle" tamano={16} color={tema.color.textoSuave} respaldo="i" />
        <Text style={s.botonTexto}>{t.enQueNosBasamos}</Text>
      </Pulsable>

      <Hoja
        visible={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={t.enQueNosBasamos}
        sub={conValores(t.cienciaSubtitulo, { n: fichas.length })}
      >
        {fichas.map((id) => {
          const c = fichaDe(id, idioma);
          return (
            <View key={id} style={estilosHoja.bloque}>
              <Text style={estilosHoja.dato}>{c.dato}</Text>
              <Text style={estilosHoja.detalle}>{c.detalle}</Text>
              {c.url !== null ? (
                <Text
                  style={estilosHoja.enlace}
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(c.url as string);
                  }}
                >
                  {t.basadoEn}: {c.fuente}
                </Text>
              ) : (
                <Text style={estilosHoja.fuente}>
                  {t.basadoEn}: {c.fuente}
                </Text>
              )}
            </View>
          );
        })}
      </Hoja>
    </>
  );
}

const s = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espacio.s,
    marginTop: 22,
    minHeight: tema.tactil,
    paddingHorizontal: 14,
    // Fondo apenas perceptible, sin borde de color. Es la regla de la v2 del panel.
    backgroundColor: `rgba(230,236,233,0.05)`,
    borderRadius: tema.radio.m,
  },
  botonTexto: { fontSize: 13.5, color: tema.color.textoSuave },
});
