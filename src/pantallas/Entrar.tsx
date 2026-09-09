import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Marca } from '../componentes/Marca';
import { Pulsable } from '../componentes/Pulsable';
import { ESCALON, useEntrada } from '../movimiento';
import * as AppleAuthentication from 'expo-apple-authentication';

import { elegirUsuario, FORMATO_USUARIO } from '../datos/amigos';
import { entrarConApple, guardarNombre, hayEntradaApple, type Cuenta } from '../datos/cuenta';
import { mensajeDe } from '../datos/errores';
import { textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Alta y entrada.
 *
 * Un toque con Apple y dentro. Sin correo, sin contrasena, sin codigo que esperar. Cada paso de
 * mas en el alta cuesta gente, y el margen es estrecho: solo el 3 % de usuarios de apps de salud
 * sigue activo a los 30 dias.
 *
 * Luego dos datos, y los dos con la razon delante porque hacen cosas distintas:
 *   - nombre visible: lo que ven los demas en la clasificacion.
 *   - nombre de usuario: con lo que te encuentran para agregarte.
 */

type Paso = 'entrar' | 'nombre' | 'usuario';
type Props = { onDentro: (cuenta: Cuenta) => void };

export function Entrar({ onDentro }: Props) {
  const t = textos();
  const [paso, setPaso] = useState<Paso>('entrar');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [hayApple, setHayApple] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La cascada de entrada del paso de marca. Los hooks van aquí arriba porque el paso cambia.
  const entradaMarca = useEntrada(0);
  const entradaTitulo = useEntrada(ESCALON);
  const entradaLema = useEntrada(ESCALON * 2);

  useEffect(() => {
    void hayEntradaApple().then(setHayApple);
  }, []);

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

  /** Al entrar, salta los pasos que esa persona ya tenga hechos. */
  function siguiente(c: Cuenta) {
    setCuenta(c);
    if (c.nombre === null || c.nombre.length === 0) {
      setNombre('');
      setPaso('nombre');
    } else if (c.usuario === null) {
      setNombre(c.nombre);
      setPaso('usuario');
    } else {
      onDentro(c);
    }
  }

  return (
    /*
      ⭐ `ScrollView` con `keyboardShouldPersistTaps` y no un `View` a pelo. Es el arreglo del
      teclado que ya se cazó en NuevaLiga y no se propagó aquí: con un `View`, el primer toque
      en el botón solo cierra el teclado y hay que tocar dos veces, y no hay forma de quitar el
      teclado tocando el fondo. Esta pantalla tiene dos pasos con TextInput, así que sufría ambos.
    */
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {paso === 'entrar' && (
        <>
          {/*
            ⭐ El momento de marca de la app: esta pantalla se ve UNA vez en la vida del
            usuario, así que aquí sí se gana la entrada escalonada (marca, nombre, lema:
            40 ms entre elementos, la regla de la skill). La marca va a tamaño de portada y
            el nombre del producto debajo, sin repetirse en el lector de pantalla porque la
            imagen es decorativa.
          */}
          <Animated.View style={entradaMarca}>
            <Marca lado={84} estilo={s.marca} />
          </Animated.View>
          {/* El nombre del producto no se traduce. */}
          <Animated.View style={entradaTitulo}>
            <Text style={s.titulo}>Compety</Text>
          </Animated.View>
          <Animated.View style={entradaLema}>
            <Text style={s.suave}>{t.entradaLema}</Text>
          </Animated.View>

          {hayApple === true && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={tema.radio.m}
              style={s.botonApple}
              onPress={() => accion(async () => {
                const c = await entrarConApple();
                // null es que canceló. No es error y no pinta nada.
                if (c !== null) siguiente(c);
              })}
            />
          )}

          {hayApple === false && <Text style={s.error}>{t.sinApple}</Text>}
        </>
      )}

      {paso === 'nombre' && (
        <>
          <Text style={s.titulo}>{t.comoTeLlamamos}</Text>
          <Text style={s.suave}>{t.nombreVisibleTexto}</Text>
          <TextInput
            style={s.campo}
            value={nombre}
            onChangeText={setNombre}
            placeholder={t.tuNombre}
            placeholderTextColor={tema.color.textoSuave}
            maxLength={40}
            accessibilityLabel={t.nombreVisible}
          />
          <Pulsable
            style={[s.boton, (ocupado || nombre.trim().length === 0) && s.botonApagado]}
            disabled={ocupado || nombre.trim().length === 0}
            accessibilityRole="button"
            onPress={() => accion(async () => {
              await guardarNombre(nombre);
              if (cuenta !== null) {
                setCuenta({ ...cuenta, nombre: nombre.trim() });
                setPaso('usuario');
              }
            })}
          >
            <Text style={s.botonTexto}>{t.seguir}</Text>
          </Pulsable>
        </>
      )}

      {paso === 'usuario' && (
        <>
          <Text style={s.titulo}>{t.eligeUsuario}</Text>
          <Text style={s.suave}>{t.usuarioTexto}</Text>
          <View style={s.conArroba}>
            <Text style={s.arroba}>@</Text>
            <TextInput
              style={[s.campo, s.campoUsuario]}
              value={usuario}
              onChangeText={(t) => setUsuario(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="tunombre"
              placeholderTextColor={tema.color.textoSuave}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              accessibilityLabel={t.nombreUsuario}
            />
          </View>
          <Text style={s.pista}>{t.formatoUsuario}</Text>
          <Pulsable
            style={[s.boton, (ocupado || !FORMATO_USUARIO.test(usuario)) && s.botonApagado]}
            disabled={ocupado || !FORMATO_USUARIO.test(usuario)}
            accessibilityRole="button"
            onPress={() => accion(async () => {
              await elegirUsuario(usuario);
              if (cuenta !== null) onDentro({ ...cuenta, usuario });
            })}
          >
            <Text style={s.botonTexto}>{t.listo}</Text>
          </Pulsable>
        </>
      )}

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // `flexGrow` y no `flex` en el contenido de un ScrollView: es lo que permite centrar en
  // vertical sin romper el scroll cuando el teclado reduce el hueco.
  contenido: { flexGrow: 1, padding: tema.espacio.l, justifyContent: 'center' },
  // ⭐ Título de PANTALLA, 22px: "¿Cómo te llamamos?" era un h1 de 15px sin cifra al lado que
  // lo justificara. Es la media-regla que ya se corrigió en Sesiones, aplicada aquí.
  titulo: { ...tema.tipo.tituloPantalla, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.l },
  marca: { marginBottom: tema.espacio.l },
  pista: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.m },
  botonApple: { height: 50, marginTop: tema.espacio.m },
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
  conArroba: { flexDirection: 'row', alignItems: 'center' },
  arroba: { ...tema.tipo.titulo, color: tema.color.textoSuave, marginRight: tema.espacio.s, marginBottom: tema.espacio.m },
  campoUsuario: { flex: 1 },
  boton: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    borderRadius: tema.radio.m,
    alignItems: 'center',
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  espera: { marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
});
