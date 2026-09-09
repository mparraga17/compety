import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Pulsable } from '../componentes/Pulsable';

import { enlaceDeLiga } from '../datos/enlaces';
import { mensajeDe } from '../datos/errores';
import { crearLiga, entrarEnLiga } from '../datos/ligas';
import { nombreLiga } from '../i18n/ligas';
import { conValores, idiomaActual, textos } from '../i18n/textos';
import { LIGAS_DEPORTE, type IdLiga } from '../motor/ligas';
import { tema } from '../tema';

/**
 * Crear liga o entrar con codigo.
 *
 * Las ligas privadas no son solo tactica de arranque, son el diseno correcto. La teoria de la
 * autodeterminacion dice que la RELACION pesa mas que la competencia y la autonomia, y en el
 * ensayo STEP UP lo que aguanto fue competicion con vinculos sociales reales, no un ranking
 * global de desconocidos.
 */

type Props = {
  modo: 'crear' | 'entrar';
  /**
   * Código que llega YA PUESTO desde un enlace de invitación. La persona ve el código y
   * confirma con un toque, en vez de teclearlo: es el paso que el enlace existe para quitar.
   */
  codigoInicial?: string;
  onHecho: () => void;
  onCancelar: () => void;
};

export function NuevaLiga({ modo, codigoInicial, onHecho, onCancelar }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState<IdLiga | null>(null);
  const [codigo, setCodigo] = useState(codigoInicial ?? '');
  const [creada, setCreada] = useState<{ codigo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  if (creada !== null) {
    return (
      <View style={s.fondo}>
        <Text style={s.titulo}>{t.ligaCreada}</Text>
        <Text style={s.suave}>{t.ligaCreadaTexto}</Text>
        <Text style={s.codigo}>{creada.codigo}</Text>
        <Pulsable
          style={s.boton}
          accessibilityRole="button"
          onPress={() =>
            void Share.share({
              // Código Y enlace: el enlace abre la app (o la página que la ofrece), y el
              // código escrito sobrevive aunque el mensajero rompa la URL.
              message: conValores(t.invitacion, {
                codigo: creada.codigo,
                enlace: enlaceDeLiga(creada.codigo),
              }),
            })
          }
        >
          <Text style={s.botonTexto}>{t.compartirCodigo}</Text>
        </Pulsable>
        <Pulsable style={s.secundario} accessibilityRole="button" onPress={onHecho}>
          <Text style={s.secundarioTexto}>{t.verClasificacion}</Text>
        </Pulsable>
      </View>
    );
  }

  if (modo === 'entrar') {
    const puedeEntrar = !ocupado && codigo.length === 6;
    const entrar = () =>
      accion(async () => {
        await entrarEnLiga(codigo);
        onHecho();
      });

    return (
      /*
        ⭐ `ScrollView` y no `View`, y no es por el scroll: es por el TECLADO.
   
        Visto en el iPhone: el teclado se abría y no había forma de quitarlo, porque un `View`
        no gestiona toques de fondo. Con `keyboardShouldPersistTaps="handled"` un toque en
        cualquier hueco cierra el teclado y un toque en un botón funciona a la primera (sin eso,
        el primer toque solo cierra el teclado y hay que tocar dos veces, que es el bug clásico).
        `keyboardDismissMode="interactive"` añade lo mismo que hace iMessage: arrastrar hacia
        abajo empuja el teclado.
      */
      <ScrollView
        style={s.fondo}
        contentContainerStyle={s.contenido}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/*
          ⭐ Vuelta ARRIBA, donde se busca. Visto en el iPhone: el único camino de salida era el
          "Cancelar" de debajo del botón, que además queda tapado por el teclado en cuanto se
          abre. Es la regla de wayfinding de Apple: toda pantalla responde "cómo salgo", y la
          respuesta tiene que estar donde el pulgar la espera, arriba a la izquierda.
        */}
        <Pulsable style={s.volver} accessibilityRole="button" onPress={onCancelar}>
          <Text style={s.volverTexto}>‹ {t.atras}</Text>
        </Pulsable>

        <Text style={s.titulo}>{t.entrarTitulo}</Text>
        <Text style={s.suave}>{t.entrarTexto}</Text>
        <TextInput
          style={[s.campo, s.campoCodigo]}
          value={codigo}
          onChangeText={(v) => setCodigo(v.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={tema.color.textoTenue}
          // Sin sugerencias del teclado encima del campo: es un código, no una palabra.
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          // El teclado se abre solo: en esta pantalla no hay otra cosa que hacer que escribir.
          autoFocus
          // "Ir" en el teclado entra directamente, sin tener que cerrar y buscar el botón.
          returnKeyType="go"
          onSubmitEditing={() => {
            if (puedeEntrar) void entrar();
          }}
          accessibilityLabel={t.entrarTitulo}
        />
        <Pulsable
          style={[s.boton, !puedeEntrar && s.botonApagado]}
          disabled={!puedeEntrar}
          accessibilityRole="button"
          onPress={entrar}
        >
          <Text style={s.botonTexto}>{t.entrar}</Text>
        </Pulsable>
        <Pulsable style={s.secundario} accessibilityRole="button" onPress={onCancelar}>
          <Text style={s.secundarioTexto}>{t.cancelar}</Text>
        </Pulsable>
        {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
        {error !== null && <Text style={s.error}>{error}</Text>}
      </ScrollView>
    );
  }

  return (
    /*
      ⭐ El arreglo del teclado del modo "entrar", propagado aquí: sin `keyboardShouldPersistTaps`
      el primer toque en una opción de deporte solo cerraba el teclado del nombre. Y la vuelta
      va también ARRIBA, que es donde el pulgar la espera y donde el teclado no la tapa.
    */
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <Pulsable style={s.volver} accessibilityRole="button" onPress={onCancelar}>
        <Text style={s.volverTexto}>‹ {t.atras}</Text>
      </Pulsable>

      <Text style={s.titulo}>{t.crearTitulo}</Text>
      <Text style={s.suave}>{t.crearTexto}</Text>

      <TextInput
        style={s.campo}
        value={nombre}
        onChangeText={setNombre}
        placeholder={t.nombreLigaEjemplo}
        placeholderTextColor={tema.color.textoSuave}
        maxLength={40}
        accessibilityLabel={t.crearTitulo}
      />

      <Text style={s.seccion}>{t.deporte}</Text>
      {/* `fila` en las opciones de deporte: son filas anchas de una lista, no botones. Se
          atenúan al pulsar, que es lo que hace iOS con las filas de una tabla. */}
      <Pulsable fila style={s.opcion} accessibilityRole="button" onPress={() => setDeporte(null)}>
        <Text style={[s.opcionTexto, deporte === null && s.opcionActiva]}>
          {nombreLiga('global', idioma)}
        </Text>
        {deporte === null && <View style={s.punto} />}
      </Pulsable>
      <Text style={s.nota}>{t.generalTexto}</Text>

      {LIGAS_DEPORTE.map((id) => (
        <Pulsable
          key={id}
          fila
          style={s.opcion}
          accessibilityRole="button"
          onPress={() => setDeporte(id)}
        >
          <Text style={[s.opcionTexto, deporte === id && s.opcionActiva]}>
            {nombreLiga(id, idioma)}
          </Text>
          {deporte === id && <View style={s.punto} />}
        </Pulsable>
      ))}

      <Pulsable
        style={[s.boton, (ocupado || nombre.trim().length === 0) && s.botonApagado]}
        disabled={ocupado || nombre.trim().length === 0}
        accessibilityRole="button"
        onPress={() => accion(async () => {
          const r = await crearLiga(nombre, deporte);
          setCreada({ codigo: r.codigo });
        })}
      >
        <Text style={s.botonTexto}>{t.crear}</Text>
      </Pulsable>
      <Pulsable style={s.secundario} accessibilityRole="button" onPress={onCancelar}>
        <Text style={s.secundarioTexto}>{t.cancelar}</Text>
      </Pulsable>

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: tema.color.fondo,
    padding: tema.espacio.l,
    // ⚠️ Ya no reserva `seguroArriba`: la pantalla vive ahora dentro de una hoja `pageSheet`,
    // que cuelga por debajo de la isla dinámica. Reservarlo dejaría un hueco doble.
    paddingTop: tema.espacio.m,
  },
  contenido: { paddingBottom: tema.espacio.xl },
  // ⭐ Título de PANTALLA, 22px: "Crear una liga" no tiene cifra al lado que justifique la
  // etiqueta de 15px. Misma regla que en Sesiones y Perfil.
  titulo: { ...tema.tipo.tituloPantalla, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.l },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.m,
    marginBottom: tema.espacio.s,
  },
  campo: {
    ...tema.tipo.cuerpo,
    minHeight: tema.tactil,
    color: tema.color.texto,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.m,
    paddingHorizontal: tema.espacio.m,
    paddingVertical: tema.espacio.m,
    marginBottom: tema.espacio.m,
  },
  /**
   * ⛔⛔ EL BUG DEL CÓDIGO RECORTADO, visto en el iPhone: las letras del placeholder salían
   * cortadas por arriba y por abajo.
   *
   * Causa exacta: `s.campo` extiende `tema.tipo.cuerpo`, que trae `lineHeight: 22` pensado para
   * texto de 15px. Aquí el `fontSize` sube a 26 pero el lineHeight heredado se quedaba en 22, así
   * que cada glifo tenía 4px menos de línea que de cuerpo y iOS lo recorta. Es el tipo de bug que
   * un spread de estilos esconde: el valor que rompe no está escrito en esta línea.
   *
   * ⇒ lineHeight explícito, con aire. Y el `letterSpacing` baja de 6 a 4: con 6 el placeholder de
   * seis caracteres quedaba más ancho que su caja en pantallas estrechas.
   */
  campoCodigo: { fontSize: 26, lineHeight: 32, letterSpacing: 4, textAlign: 'center' },
  volver: { minHeight: tema.tactil, justifyContent: 'center', marginBottom: tema.espacio.s },
  volverTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  // 44 de alto: la lista de deportes es la que mas se toca de toda la app.
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: tema.tactil,
  },
  opcionTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  opcionActiva: { color: tema.color.texto, fontWeight: '600' },
  punto: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: tema.color.marca,
    marginLeft: tema.espacio.s,
  },
  nota: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.s },
  codigo: {
    fontSize: 42,
    fontWeight: '600',
    color: tema.color.marca,
    letterSpacing: 8,
    textAlign: 'center',
    marginVertical: tema.espacio.l,
  },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    borderRadius: tema.radio.m,
    alignItems: 'center',
    marginTop: tema.espacio.m,
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { minHeight: tema.tactil, justifyContent: 'center', alignItems: 'center' },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  espera: { marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
});
