import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Aparece } from '../componentes/Aparece';
import { Avatar } from '../componentes/Avatar';
import { Pulsable } from '../componentes/Pulsable';
import { Recarga } from '../componentes/Recarga';
import { mensajeDe } from '../datos/errores';
import {
  EMOJIS,
  alternaReaccion,
  borrarComentario,
  comentar,
  comentariosDe,
  feed,
  ocultarEntreno,
  reaccionar,
  reaccionesDe,
  tiempoRelativo,
  type Comentario,
  type Emoji,
  type Entreno,
  type Reaccion,
} from '../datos/feed';
import { conValores, idiomaActual, textos, type Textos } from '../i18n/textos';
import { iconoDe, nombreDeTipo } from '../motor/actividades';
import { tema } from '../tema';

/**
 * El feed de amigos: la segunda página de Competi.
 *
 * ⭐ Es la pieza social que faltaba, pedida por el usuario el primer día con amigos en TestFlight:
 * "un deslizamiento a la derecha como en TikTok que pasa del Para ti al feed de amigos, donde ver
 * las sesiones y comentar o reaccionar en plan Twitter". La clasificación compite; el feed anima.
 *
 * Criterio visual, el de toda la app: cero bordes de color, filas separadas por una línea fina, la
 * jerarquía la hace la tipografía y el color aparece solo cuando significa algo (una sesión
 * FUERTE va en marca; una normal, en el tono del texto).
 *
 * Reaccionar es optimista: la fila cambia al tocar y el servidor confirma después. Si falla, se
 * deshace y se avisa. Es lo que hace que un toque se sienta como un toque y no como una petición.
 */

const PAGINA = 30;

type Props = {
  yo: string | null;
  /** true cuando esta página está a la vista. La primera carga espera a que lo esté. */
  activo: boolean;
  /** Cambia cuando llega un aviso de reacción o comentario: se recarga. */
  senal?: number;
  onAmigos: () => void;
};

export function Feed({ yo, activo, senal = 0, onAmigos }: Props) {
  const idioma = idiomaActual();
  const t = textos(idioma);
  const [entrenos, setEntrenos] = useState<readonly Entreno[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [masCargando, setMasCargando] = useState(false);
  const [finLista, setFinLista] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Entreno | null>(null);
  const ahora = Date.now();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const primera = await feed(PAGINA);
      setEntrenos(primera);
      setFinLista(primera.length < PAGINA);
    } catch (e) {
      setError(mensajeDe(e));
      // Sin datos previos, la lista vacía enseñaría el estado vacío, que sería mentir.
      setEntrenos((prev) => prev ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarMas = useCallback(async () => {
    if (entrenos === null || entrenos.length === 0 || finLista || masCargando) return;
    setMasCargando(true);
    try {
      const ultimo = entrenos[entrenos.length - 1];
      const siguiente = await feed(PAGINA, ultimo.fin);
      setEntrenos((prev) => [...(prev ?? []), ...siguiente]);
      setFinLista(siguiente.length < PAGINA);
    } catch {
      // El botón sigue ahí para reintentar.
    } finally {
      setMasCargando(false);
    }
  }, [entrenos, finLista, masCargando]);

  // Primera carga al llegar a la página; después, cada vez que un aviso lo pida.
  const cargado = useRef(false);
  useEffect(() => {
    if (!activo) return;
    if (cargado.current && senal === 0) return;
    cargado.current = true;
    void cargar();
  }, [activo, senal, cargar]);

  const reemplaza = (nuevo: Entreno) =>
    setEntrenos((prev) => (prev ?? []).map((e) => (e.id === nuevo.id ? nuevo : e)));

  const tocarEmoji = async (e: Entreno, emoji: Emoji) => {
    const optimista = alternaReaccion(e, emoji);
    reemplaza(optimista);
    if (abierto?.id === e.id) setAbierto(optimista);
    try {
      await reaccionar(e.id, optimista.miReaccion);
    } catch (err) {
      reemplaza(e);
      Alert.alert(t.feedAmigos, mensajeDe(err));
    }
  };

  const quitar = (e: Entreno) => {
    Alert.alert(t.feedQuitar, t.feedQuitarAviso, [
      { text: t.cancelar, style: 'cancel' },
      {
        text: t.feedQuitar,
        style: 'destructive',
        onPress: () => {
          void ocultarEntreno(e.id)
            .then(() => {
              setEntrenos((prev) => (prev ?? []).filter((x) => x.id !== e.id));
              setAbierto(null);
            })
            .catch((err) => Alert.alert(t.feedQuitar, mensajeDe(err)));
        },
      },
    ]);
  };

  const vacio = entrenos !== null && entrenos.length === 0;

  return (
    <View style={s.fondo}>
      <FlatList
        data={entrenos ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[s.contenido, vacio && s.contenidoVacio]}
        refreshControl={<Recarga cargando={cargando} onRecargar={() => void cargar()} pegado />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void cargarMas()}
        ListHeaderComponent={
          error !== null ? <Text style={s.error}>{t.feedError}</Text> : null
        }
        ListEmptyComponent={
          entrenos === null ? (
            <ActivityIndicator color={tema.color.marca} style={s.rueda} />
          ) : (
            <Vacio t={t} onAmigos={onAmigos} />
          )
        }
        ListFooterComponent={
          entrenos !== null && entrenos.length > 0 ? (
            <View style={s.pie}>
              {!finLista &&
                (masCargando ? (
                  <ActivityIndicator color={tema.color.marca} />
                ) : (
                  <Pulsable style={s.cargarMas} onPress={() => void cargarMas()} accessibilityRole="button">
                    <Text style={s.cargarMasTexto}>{t.feedCargarMas}</Text>
                  </Pulsable>
                ))}
              <Text style={s.privacidad}>{t.feedPrivacidad}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Aparece indice={index}>
            <Tarjeta
              e={item}
              esMio={item.usuario === yo}
              ahora={ahora}
              t={t}
              idioma={idioma}
              onEmoji={(emoji) => void tocarEmoji(item, emoji)}
              onComentarios={() => setAbierto(item)}
              onQuitar={() => quitar(item)}
            />
          </Aparece>
        )}
      />

      {abierto !== null && (
        <HojaComentarios
          e={abierto}
          yo={yo}
          t={t}
          idioma={idioma}
          onCerrar={() => setAbierto(null)}
          onEmoji={(emoji) => void tocarEmoji(abierto, emoji)}
          onCambioComentarios={(n) => {
            const nuevo = { ...abierto, comentarios: n };
            reemplaza(nuevo);
            setAbierto(nuevo);
          }}
        />
      )}
    </View>
  );
}

/** Estado vacío: qué es esto y cómo llenarlo. Sin gráficos vacíos que parezcan un error. */
function Vacio({ t, onAmigos }: { t: Textos; onAmigos: () => void }) {
  return (
    <View style={s.vacio}>
      <Text style={s.vacioTitulo}>{t.feedVacio}</Text>
      <Text style={s.vacioTexto}>{t.feedVacioTexto}</Text>
      <Text style={s.vacioTexto}>{t.feedSinGente}</Text>
      <Pulsable style={s.boton} onPress={onAmigos} accessibilityRole="button">
        <Text style={s.botonTexto}>{t.agregarAmigos}</Text>
      </Pulsable>
    </View>
  );
}

function etiquetaTono(tono: Entreno['tono'], t: Textos): string {
  if (tono === 'fuerte') return t.feedSesionFuerte;
  if (tono === 'suave') return t.feedSesionSuave;
  return t.feedSesionNormal;
}

function Tarjeta({
  e,
  esMio,
  ahora,
  t,
  idioma,
  onEmoji,
  onComentarios,
  onQuitar,
}: {
  e: Entreno;
  esMio: boolean;
  ahora: number;
  t: Textos;
  idioma: 'es' | 'en';
  onEmoji: (emoji: Emoji) => void;
  onComentarios: () => void;
  onQuitar: () => void;
}) {
  const fuerte = e.tono === 'fuerte';
  const nombre = esMio ? t.feedTuEntreno : e.nombre;

  return (
    <View style={s.tarjeta}>
      <View style={s.filaArriba}>
        <Avatar nombre={e.nombre} esYo={esMio} />
        <View style={s.medio}>
          <View style={s.nombreFila}>
            <Text style={[s.nombre, esMio && s.nombreYo]} numberOfLines={1}>
              {nombre}
            </Text>
            <Text style={s.cuando}>{tiempoRelativo(e.fin, ahora, t)}</Text>
          </View>
          <Text style={s.detalle} numberOfLines={1}>
            {iconoDe(e.deporte)} {nombreDeTipo(e.deporte, idioma)}
            <Text style={s.punto}> · </Text>
            <Text style={fuerte ? s.tonoFuerte : undefined}>{etiquetaTono(e.tono, t)}</Text>
          </Text>
        </View>
        <Text style={[s.puntos, fuerte && s.puntosFuerte]}>{e.puntos}</Text>
      </View>

      <View style={s.acciones}>
        {EMOJIS.map((emoji) => {
          const n = e.reacciones[emoji] ?? 0;
          const mia = e.miReaccion === emoji;
          return (
            <Pulsable
              key={emoji}
              style={[s.reaccion, mia && s.reaccionMia]}
              onPress={() => onEmoji(emoji)}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: mia }}
              accessibilityLabel={`${emoji} ${n}`}
            >
              <Text style={s.emoji}>{emoji}</Text>
              {n > 0 && <Text style={[s.cuenta, mia && s.cuentaMia]}>{n}</Text>}
            </Pulsable>
          );
        })}
        <View style={s.hueco} />
        <Pulsable
          style={s.comentarios}
          onPress={onComentarios}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t.feedComentarios}
        >
          <Text style={s.comentariosTexto}>
            {e.comentarios === 0
              ? t.feedComentar
              : e.comentarios === 1
                ? t.feedUnComentario
                : conValores(t.feedNComentarios, { n: e.comentarios })}
          </Text>
        </Pulsable>
        {esMio && (
          <Pulsable
            style={s.quitar}
            onPress={onQuitar}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t.feedQuitar}
          >
            <Text style={s.quitarTexto}>×</Text>
          </Pulsable>
        )}
      </View>
    </View>
  );
}

/**
 * Hoja de un entreno: quién ha reaccionado, los comentarios y la caja para escribir.
 *
 * Es un `Modal` propio y no la `Hoja` compartida porque la caja de texto tiene que quedarse
 * abajo, fija, encima del teclado; la Hoja mete todo en un scroll con el botón de cerrar al final.
 */
function HojaComentarios({
  e,
  yo,
  t,
  idioma,
  onCerrar,
  onEmoji,
  onCambioComentarios,
}: {
  e: Entreno;
  yo: string | null;
  t: Textos;
  idioma: 'es' | 'en';
  onCerrar: () => void;
  onEmoji: (emoji: Emoji) => void;
  onCambioComentarios: (n: number) => void;
}) {
  const [comentarios, setComentarios] = useState<readonly Comentario[] | null>(null);
  const [reacciones, setReacciones] = useState<readonly Reaccion[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ahora = Date.now();

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [c, r] = await Promise.all([
        comentariosDe(e.id).catch(() => [] as Comentario[]),
        reaccionesDe(e.id).catch(() => [] as Reaccion[]),
      ]);
      if (!vivo) return;
      setComentarios(c);
      setReacciones(r);
    })();
    return () => {
      vivo = false;
    };
    // Solo al abrir: las reacciones cambian en vivo por `e`, los comentarios por `enviar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.id]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio.length === 0 || enviando) return;
    setEnviando(true);
    try {
      const id = await comentar(e.id, limpio);
      const nuevo: Comentario = {
        id,
        usuario: yo ?? '',
        nombre: t.feedTuEntreno,
        texto: limpio,
        creado: Date.now(),
      };
      const lista = [...(comentarios ?? []), nuevo];
      setComentarios(lista);
      onCambioComentarios(lista.length);
      setTexto('');
    } catch (err) {
      Alert.alert(t.feedComentar, mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  const borrar = (c: Comentario) => {
    void borrarComentario(c.id)
      .then(() => {
        const lista = (comentarios ?? []).filter((x) => x.id !== c.id);
        setComentarios(lista);
        onCambioComentarios(lista.length);
      })
      .catch((err) => Alert.alert(t.borrar, mensajeDe(err)));
  };

  const puedeEnviar = texto.trim().length > 0 && !enviando;
  const esMio = e.usuario === yo;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={s.hoja}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.agarre} />
        <View style={s.hojaCabecera}>
          <View style={s.medio}>
            <Text style={s.hojaTitulo}>{t.feedComentarios}</Text>
            <Text style={s.hojaSub} numberOfLines={1}>
              {esMio ? t.feedTuEntreno : e.nombre} · {nombreDeTipo(e.deporte, idioma)} ·{' '}
              {tiempoRelativo(e.fin, ahora, t)}
            </Text>
          </View>
          <Pulsable onPress={onCerrar} accessibilityRole="button" hitSlop={8}>
            <Text style={s.cerrar}>{t.cerrar}</Text>
          </Pulsable>
        </View>

        {/* Reaccionar también desde aquí: la hoja es el detalle del entreno, no solo los textos. */}
        <View style={[s.acciones, s.accionesHoja]}>
          {EMOJIS.map((emoji) => {
            const n = e.reacciones[emoji] ?? 0;
            const mia = e.miReaccion === emoji;
            return (
              <Pulsable
                key={emoji}
                style={[s.reaccion, mia && s.reaccionMia]}
                onPress={() => onEmoji(emoji)}
                accessibilityRole="button"
                accessibilityState={{ selected: mia }}
                accessibilityLabel={`${emoji} ${n}`}
              >
                <Text style={s.emoji}>{emoji}</Text>
                {n > 0 && <Text style={[s.cuenta, mia && s.cuentaMia]}>{n}</Text>}
              </Pulsable>
            );
          })}
        </View>
        {reacciones.length > 0 && (
          <Text style={s.quienes} numberOfLines={2}>
            {t.feedReaccionaron}:{' '}
            {reacciones.map((r) => `${r.usuario === yo ? t.feedTuEntreno : r.nombre} ${r.emoji}`).join(' · ')}
          </Text>
        )}

        <FlatList
          style={s.lista}
          data={comentarios ?? []}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.listaContenido}
          ListEmptyComponent={
            comentarios === null ? (
              <ActivityIndicator color={tema.color.marca} style={s.rueda} />
            ) : (
              <Text style={s.sinComentarios}>{t.feedSinComentarios}</Text>
            )
          }
          renderItem={({ item }) => {
            const propio = item.usuario === yo;
            return (
              <View style={s.comentario}>
                <Avatar nombre={item.nombre} esYo={propio} tamano={28} />
                <View style={s.medio}>
                  <View style={s.nombreFila}>
                    <Text style={[s.comentarioNombre, propio && s.nombreYo]} numberOfLines={1}>
                      {propio ? t.feedTuEntreno : item.nombre}
                    </Text>
                    <Text style={s.cuando}>{tiempoRelativo(item.creado, ahora, t)}</Text>
                  </View>
                  <Text style={s.comentarioTexto}>{item.texto}</Text>
                </View>
                {/* Lo borra su autor, o el dueño del entreno (modera lo suyo). */}
                {(propio || esMio) && (
                  <Pulsable onPress={() => borrar(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.borrar}>
                    <Text style={s.quitarTexto}>×</Text>
                  </Pulsable>
                )}
              </View>
            );
          }}
        />

        <View style={s.caja}>
          <TextInput
            style={s.entrada}
            value={texto}
            onChangeText={setTexto}
            placeholder={t.feedEscribe}
            placeholderTextColor={tema.color.textoTenue}
            maxLength={280}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => void enviar()}
            accessibilityLabel={t.feedComentar}
          />
          <Pulsable
            style={[s.enviar, !puedeEnviar && s.enviarApagado]}
            onPress={() => void enviar()}
            disabled={!puedeEnviar}
            accessibilityRole="button"
          >
            <Text style={s.enviarTexto}>{t.feedEnviar}</Text>
          </Pulsable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1 },
  contenido: { paddingBottom: tema.espacio.xl * 2 },
  contenidoVacio: { flexGrow: 1, justifyContent: 'center' },
  rueda: { marginTop: tema.espacio.xl },
  error: {
    ...tema.tipo.detalle,
    color: tema.color.bajo,
    paddingHorizontal: tema.espacio.l,
    paddingVertical: tema.espacio.s,
  },

  tarjeta: {
    paddingHorizontal: tema.espacio.l,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medio: { flex: 1, minWidth: 0 },
  nombreFila: { flexDirection: 'row', alignItems: 'baseline', gap: tema.espacio.s },
  nombre: { ...tema.tipo.cuerpo, color: tema.color.texto, fontWeight: '600', flexShrink: 1 },
  nombreYo: { color: tema.color.marca },
  cuando: { ...tema.tipo.micro, color: tema.color.textoTenue },
  detalle: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginTop: 1 },
  punto: { color: tema.color.textoTenue },
  // El color solo cuando significa algo: una sesión fuerte para esa persona.
  tonoFuerte: { color: tema.color.marca, fontWeight: '600' },
  puntos: { ...tema.tipo.valor, color: tema.color.texto },
  puntosFuerte: { color: tema.color.marca },

  acciones: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  accionesHoja: { paddingHorizontal: tema.espacio.l, marginTop: tema.espacio.s },
  reaccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
  },
  // La tuya se marca con relleno, no con borde: la regla de la v2.
  reaccionMia: { backgroundColor: 'rgba(198,203,240,0.16)' },
  emoji: { fontSize: 16, lineHeight: 20 },
  cuenta: { ...tema.tipo.detalle, color: tema.color.textoSuave, ...tema.cifras },
  cuentaMia: { color: tema.color.marca, fontWeight: '600' },
  hueco: { flex: 1 },
  comentarios: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 8 },
  comentariosTexto: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
  quitar: { minHeight: 34, minWidth: 30, alignItems: 'center', justifyContent: 'center' },
  quitarTexto: { fontSize: 18, color: tema.color.textoTenue, lineHeight: 22 },

  pie: { paddingHorizontal: tema.espacio.l, paddingTop: tema.espacio.l, gap: tema.espacio.m, alignItems: 'center' },
  cargarMas: { minHeight: tema.tactil, justifyContent: 'center', paddingHorizontal: tema.espacio.l },
  cargarMasTexto: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600' },
  privacidad: { ...tema.tipo.micro, color: tema.color.textoTenue, textAlign: 'center' },

  vacio: { paddingHorizontal: tema.espacio.l, alignItems: 'center', gap: tema.espacio.s },
  vacioTitulo: { fontSize: 22, fontWeight: '600', color: tema.color.texto, textAlign: 'center', letterSpacing: -0.4 },
  vacioTexto: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, textAlign: 'center' },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.l,
    borderRadius: tema.radio.m,
    marginTop: tema.espacio.m,
  },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600', textAlign: 'center' },

  // La hoja de comentarios. Misma anatomía que `Hoja`: agarre, título de 22, fondo de la app.
  hoja: { flex: 1, backgroundColor: tema.color.fondo, paddingTop: tema.espacio.m },
  agarre: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(230,236,233,0.18)',
    alignSelf: 'center',
    marginBottom: tema.espacio.m,
  },
  hojaCabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tema.espacio.m,
    paddingHorizontal: tema.espacio.l,
  },
  hojaTitulo: { fontSize: 22, fontWeight: '600', color: tema.color.texto, letterSpacing: -0.4 },
  hojaSub: { ...tema.tipo.sub, color: tema.color.textoSuave, marginTop: 2 },
  cerrar: { ...tema.tipo.cuerpo, color: tema.color.marca, fontWeight: '600', paddingVertical: 4 },
  quienes: {
    ...tema.tipo.detalle,
    color: tema.color.textoSuave,
    paddingHorizontal: tema.espacio.l,
    marginTop: tema.espacio.s,
  },
  lista: { flex: 1, marginTop: tema.espacio.s },
  listaContenido: { paddingHorizontal: tema.espacio.l, paddingBottom: tema.espacio.m },
  sinComentarios: { ...tema.tipo.detalle, color: tema.color.textoTenue, paddingVertical: tema.espacio.l, textAlign: 'center' },
  comentario: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  comentarioNombre: { ...tema.tipo.detalle, color: tema.color.texto, fontWeight: '600', flexShrink: 1 },
  comentarioTexto: { ...tema.tipo.cuerpo, color: tema.color.texto, marginTop: 1 },
  caja: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tema.espacio.s,
    paddingHorizontal: tema.espacio.m,
    paddingTop: tema.espacio.s,
    paddingBottom: tema.espacio.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  entrada: {
    flex: 1,
    ...tema.tipo.cuerpo,
    color: tema.color.texto,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.m,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 120,
  },
  enviar: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.m,
    borderRadius: tema.radio.m,
  },
  enviarApagado: { opacity: 0.4 },
  enviarTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
});
