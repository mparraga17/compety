import { StyleSheet, Text, View } from 'react-native';

import { Pulsable } from './Pulsable';
import { eligeIdioma, idiomaActual, textos, type Idioma as IdIdioma } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Ajuste de idioma, en forma de filas con marca de selección.
 *
 * ⛔⛔ ANTES ERA UN CONMUTADOR ES/EN EN LA CABECERA DE LA CLASIFICACIÓN, y el usuario dijo que
 * quedaba "bastante feo" y suelto. Tenía razón, y hay tres motivos concretos por debajo de la
 * impresión:
 *
 *   1. **Estaba en el sitio de la acción principal.** La cabecera de Competi tiene el nombre del
 *      producto, agregar amigos y tu perfil. El idioma se cambia UNA vez en la vida de la app y
 *      estaba compitiendo por espacio con la acción que hace crecer el producto. Es el reparto al
 *      revés: Apple lo llama *"show the common path first, advanced options one level deeper"*.
 *
 *   2. **Las letras eran de 10px.** Por debajo de lo que se puede leer con comodidad, y el objetivo
 *      táctil se quedaba en unos 24 puntos cuando la guía de Apple pide 44. Estaba pequeño porque
 *      no cabía de otra forma, que es la señal de que el elemento no iba en ese sitio.
 *
 *   3. **Dos cápsulas juntas no dicen cuál está activa.** Con `ES` y `EN` una al lado de la otra y
 *      un fondo apenas distinto, hay que fijarse para saber en cuál estás. Una lista con marca de
 *      selección lo dice sin ambigüedad, y es además el patrón que usa iOS en sus propios ajustes,
 *      o sea que no hay que aprenderlo.
 *
 * ⇒ Ahora vive en Perfil, que es donde están el resto de los ajustes de cuenta. Se llega con un
 * toque en tu inicial, que es el mismo camino que usan Twitter o Instagram para lo mismo.
 */

type Props = { onCambio: (idioma: IdIdioma) => void };

const IDIOMAS: readonly { id: IdIdioma; nombre: string }[] = [
  // ⚠️ Cada idioma en SU propio idioma, nunca traducido. "Spanish" no se lo busca quien tiene el
  // móvil en español, y es la convención de cualquier selector de idioma del sistema.
  { id: 'es', nombre: 'Español' },
  { id: 'en', nombre: 'English' },
];

export function Idioma({ onCambio }: Props) {
  const activo = idiomaActual();
  const t = textos(activo);

  return (
    <View>
      {IDIOMAS.map(({ id, nombre }) => {
        const on = id === activo;
        return (
          <Pulsable
            key={id}
            fila
            style={s.fila}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={nombre}
            onPress={() => {
              eligeIdioma(id);
              onCambio(id);
            }}
          >
            <Text style={[s.nombre, on && s.nombreOn]}>{nombre}</Text>
            {/* Marca de selección, no un fondo de color: la jerarquía la hace el peso
                tipográfico. Es la regla de la v2 del panel, la misma que usa el `Selector`. */}
            {on && <Text style={s.marca}>✓</Text>}
          </Pulsable>
        );
      })}
      <Text style={s.pista}>{t.idiomaPista}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 44 puntos, lo que pide la guía de Apple. El conmutador de antes se quedaba en 24.
    minHeight: tema.tactil,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  nombre: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  nombreOn: { color: tema.color.texto, fontWeight: '500' },
  marca: { fontSize: 14, color: tema.color.marca },
  pista: { ...tema.tipo.micro, color: tema.color.textoTenue, marginTop: tema.espacio.s },
});
