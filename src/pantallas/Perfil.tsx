import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '../componentes/Avatar';
import { Idioma } from '../componentes/Idioma';
import { Pulsable } from '../componentes/Pulsable';
import { Simbolo } from '../componentes/Simbolo';
import { elegirUsuario, FORMATO_USUARIO } from '../datos/amigos';
import { borrarCuenta, guardarNombre, salir, type Cuenta } from '../datos/cuenta';
import { paginaPrivacidad, paginaTerminos } from '../datos/enlaces';
import { mensajeDe } from '../datos/errores';
import { idiomaActual, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Perfil: tu nombre, tu identificador y las acciones de cuenta.
 *
 * Se separo de la clasificacion porque son dos cosas distintas: la liga es para mirar como vas,
 * el perfil es para cambiar quien eres. Meterlo todo en una pantalla obligaba a bajar por el
 * ranking entero para editar el nombre.
 *
 * ⭐ Los dos nombres llevan la explicacion al lado, no debajo en letra pequena. Hacen cosas
 * distintas y confundirlos tiene consecuencias: el visible se ve en la clasificacion, el de
 * usuario es con el que te encuentran.
 *
 * ⚠️ Apple exige poder borrar la cuenta desde DENTRO de la app (no vale escribir a soporte), y
 * es rechazo directo si falta. Esta abajo, con confirmacion porque no tiene vuelta.
 */

type Props = {
  cuenta: Cuenta;
  onCambio: (cuenta: Cuenta) => void;
  onFuera: () => void;
  onAmigos: () => void;
  /**
   * Avisa de que cambió el idioma, para que la app entera se repinte.
   *
   * ⚠️ Sube hasta `App.tsx` a propósito: el idioma vive en una variable de módulo, así que cambiarla
   * no dispara ningún render. Hace falta que un `useState` de arriba cambie para que se repinten
   * también las pestañas y la barra inferior, no solo esta pantalla.
   */
  onIdioma: () => void;
};

export function Perfil({ cuenta, onCambio, onFuera, onAmigos, onIdioma }: Props) {
  const t = textos();
  const [nombre, setNombre] = useState(cuenta.nombre ?? '');
  const [usuario, setUsuario] = useState(cuenta.usuario ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const nombreCambio = nombre.trim() !== (cuenta.nombre ?? '') && nombre.trim().length > 0;
  const usuarioCambio = usuario !== (cuenta.usuario ?? '') && FORMATO_USUARIO.test(usuario);

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  function confirmarBorrado() {
    Alert.alert(
      t.borrarCuenta,
      t.borrarAviso,
      [
        { text: t.cancelar, style: 'cancel' },
        {
          text: t.borrar,
          style: 'destructive',
          onPress: () => void accion(async () => {
            // Vuelve a pedir Sign in with Apple para poder revocarlo; si se cancela esa hoja,
            // `borrarCuenta` devuelve false y aquí no pasa nada.
            const hecho = await borrarCuenta();
            if (hecho) onFuera();
          }),
        },
      ],
    );
  }

  return (
    /*
      ⭐ Con gestión de teclado, que faltaba: es el arreglo de NuevaLiga que no se propagó. Sin
      `keyboardShouldPersistTaps` el primer toque en "Guardar" solo cerraba el teclado y había
      que tocar dos veces, y esta pantalla tiene dos campos de texto.
    */
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={s.cabecera}>
        {/* El avatar compartido, en grande: el mismo que en la cabecera de cada pestaña. */}
        <View style={s.avatarGrande}>
          <Avatar
            nombre={cuenta.nombre ?? cuenta.usuario ?? '?'}
            inicial={(cuenta.nombre ?? cuenta.usuario ?? '?').slice(0, 1).toUpperCase()}
            esYo
            tamano={56}
          />
        </View>
        <View style={s.cabeceraTexto}>
          <Text style={s.titulo}>{cuenta.nombre ?? t.tuPerfil}</Text>
          {cuenta.usuario !== null && <Text style={s.suave}>@{cuenta.usuario}</Text>}
        </View>
      </View>

      {/* `fila`: es una fila a todo lo ancho, así que se atenúa en vez de escalar. Escalarla
          dejaría ver el fondo por los lados y se leería como un fallo de dibujo. */}
      <Pulsable fila style={s.opcion} accessibilityRole="button" onPress={onAmigos}>
        <Text style={s.opcionTexto}>{t.amigos}</Text>
        {/* El chevron del sistema, el de las filas de Ajustes de iOS. */}
        <Simbolo nombre="chevron.right" tamano={14} color={tema.color.textoTenue} peso="semibold" respaldo="›" />
      </Pulsable>

      {/* ── Nombre visible ─────────────────────────────────────────────────── */}
      <Text style={s.seccion}>{t.nombreVisible}</Text>
      <Text style={s.pista}>{t.nombreVisibleCorto}</Text>
      <TextInput
        style={s.campo}
        value={nombre}
        onChangeText={setNombre}
        placeholder={t.tuNombre}
        placeholderTextColor={tema.color.textoSuave}
        maxLength={40}
        accessibilityLabel={t.nombreVisible}
      />
      {nombreCambio && (
        <Pulsable
          style={[s.boton, ocupado && s.apagado]}
          disabled={ocupado}
          accessibilityRole="button"
          onPress={() => accion(async () => {
            await guardarNombre(nombre);
            onCambio({ ...cuenta, nombre: nombre.trim() });
            setAviso(t.nombreGuardado);
          })}
        >
          <Text style={s.botonTexto}>{t.guardarNombre}</Text>
        </Pulsable>
      )}

      {/* ── Nombre de usuario ──────────────────────────────────────────────── */}
      <Text style={s.seccion}>{t.nombreUsuario}</Text>
      <Text style={s.pista}>{t.usuarioTexto}</Text>
      <View style={s.conArroba}>
        <Text style={s.arroba}>@</Text>
        <TextInput
          style={[s.campo, s.campoFlex]}
          value={usuario}
          onChangeText={(v) => setUsuario(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="tunombre"
          placeholderTextColor={tema.color.textoSuave}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          accessibilityLabel={t.nombreUsuario}
        />
      </View>
      {usuarioCambio && (
        <Pulsable
          style={[s.boton, ocupado && s.apagado]}
          disabled={ocupado}
          accessibilityRole="button"
          onPress={() => accion(async () => {
            await elegirUsuario(usuario);
            onCambio({ ...cuenta, usuario });
            setAviso(t.usuarioGuardado);
          })}
        >
          <Text style={s.botonTexto}>{t.guardarUsuario}</Text>
        </Pulsable>
      )}

      {aviso !== null && <Text style={s.aviso}>{aviso}</Text>}
      {error !== null && <Text style={s.error}>{error}</Text>}
      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}

      {/* ── Ajustes ────────────────────────────────────────────────────────────
        ⭐ El idioma vive AQUÍ, no en la cabecera de la clasificación.

        Estaba allí como un conmutador ES/EN de 10px, y el usuario dijo que quedaba feo y suelto.
        El diagnóstico de fondo: es un ajuste que se toca una vez y estaba ocupando espacio junto a
        la acción principal del producto. Apple: *"show the common path first, advanced options one
        level deeper"*. Un toque en tu inicial es exactamente ese nivel, y es el camino que usan
        Twitter e Instagram para lo mismo.
      */}
      <Text style={s.seccion}>{t.ajustes}</Text>
      <Text style={s.pista}>{t.idioma}</Text>
      <Idioma onCambio={onIdioma} />

      {/*
        ⭐ Los documentos legales, accesibles SIEMPRE y no solo en el alta: Apple lo revisa en
        apps con cuenta y HealthKit, y es donde cualquiera espera encontrarlos. Abren el
        navegador en el idioma de la interfaz: el documento vive en la web, una sola verdad.
      */}
      <Pulsable
        fila
        style={s.opcion}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(paginaPrivacidad(idiomaActual()))}
      >
        <Text style={s.opcionTexto}>{t.verPrivacidad}</Text>
      </Pulsable>
      <Pulsable
        fila
        style={s.opcion}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(paginaTerminos(idiomaActual()))}
      >
        <Text style={s.opcionTexto}>{t.verTerminos}</Text>
      </Pulsable>

      {/* ── Cuenta ─────────────────────────────────────────────────────────── */}
      <Text style={s.seccion}>{t.cuenta}</Text>
      <Text style={s.pista}>{t.cuentaTexto}</Text>

      <Pulsable
        fila
        style={s.opcion}
        accessibilityRole="button"
        onPress={() => accion(async () => {
          await salir();
          onFuera();
        })}
      >
        <Text style={s.opcionTexto}>{t.cerrarSesion}</Text>
      </Pulsable>

      <Pulsable fila style={s.opcion} accessibilityRole="button" onPress={confirmarBorrado}>
        <Text style={s.opcionPeligro}>{t.borrarCuenta}</Text>
      </Pulsable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  contenido: { padding: tema.espacio.l, paddingBottom: tema.espacio.xl * 2 },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: tema.espacio.l },
  avatarGrande: { marginRight: tema.espacio.m },
  cabeceraTexto: { flex: 1 },
  // ⭐ Título de PANTALLA, 22px: tu nombre es el encabezado de Perfil y no hay cifra que
  // justifique la etiqueta de 15px. Misma regla que en Sesiones y las pantallas de entrada.
  titulo: { ...tema.tipo.tituloPantalla, color: tema.color.texto },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
    marginBottom: tema.espacio.xs,
  },
  pista: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.s },
  campo: {
    ...tema.tipo.cuerpo,
    minHeight: tema.tactil,
    color: tema.color.texto,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.m,
    paddingHorizontal: tema.espacio.m,
  },
  campoFlex: { flex: 1 },
  conArroba: { flexDirection: 'row', alignItems: 'center' },
  arroba: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginRight: tema.espacio.xs },
  // Filas de opción con separador, como las de Ajustes de iOS: eran las únicas filas de la app
  // sin línea (rediseño del 15 sep).
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: tema.tactil,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.color.linea,
  },
  opcionTexto: { ...tema.tipo.cuerpo, color: tema.color.texto },
  opcionPeligro: { ...tema.tipo.cuerpo, color: tema.color.bajo },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tema.radio.m,
    marginTop: tema.espacio.s,
  },
  apagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  aviso: { ...tema.tipo.detalle, color: tema.color.marca, marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
  espera: { marginTop: tema.espacio.m },
});
