import { Linking, Text } from 'react-native';

import { Hoja, estilosHoja } from './Hoja';
import { fichaDe, type ClaveCiencia } from '../motor/ciencia';
import { idiomaActual, textos } from '../i18n/textos';

/**
 * Ficha de UNA fuente, para abrir al tocar un dato concreto.
 *
 * Se diferencia de `Ciencia` en el alcance: aquel es el botón del final que recoge todas las
 * fuentes de la pestaña, y este responde a "¿qué es esto que estoy mirando?" cuando tocas una
 * métrica. La maqueta tiene las dos cosas.
 *
 * ⚠️ El idioma se resuelve aquí con `fichaDe`. Es el mismo cuidado que arregló el bug de la hoja
 * de ciencia, que salía en español con la app en inglés.
 */

type Props = {
  /** null cierra la hoja. */
  clave: ClaveCiencia | null;
  onCerrar: () => void;
};

export function Ficha({ clave, onCerrar }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const c = clave === null ? null : fichaDe(clave, idioma);

  return (
    <Hoja visible={c !== null} onCerrar={onCerrar} titulo={c?.dato}>
      {c !== null && (
        <>
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
        </>
      )}
    </Hoja>
  );
}
