import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { entrarConCodigo, guardarNombre, pedirEnlace, type Cuenta } from '../datos/cuenta';
import { tema } from '../tema';

/**
 * Alta y entrada.
 *
 * Correo con codigo de seis digitos, sin contrasena. Cada paso de mas en el alta cuesta gente,
 * y el margen es estrecho: solo el 3 % de usuarios de apps de salud sigue activo a los 30 dias.
 *
 * El nombre se pide al final y con la razon delante: es lo unico que van a ver los demas.
 */

type Paso = 'correo' | 'codigo' | 'nombre';
type Props = { onDentro: (cuenta: Cuenta) => void };

export function Entrar({ onDentro }: Props) {
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View style={s.fondo}>
      {paso === 'correo' && (
        <>
          <Text style={s.titulo}>Entra con tu correo</Text>
          <Text style={s.suave}>
            Te mandamos un código de seis dígitos. Sin contraseñas que recordar.
          </Text>
          <TextInput
            style={s.campo}
            value={correo}
            onChangeText={setCorreo}
            placeholder="tucorreo@ejemplo.com"
            placeholderTextColor={tema.color.textoSuave}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            accessibilityLabel="Correo electrónico"
          />
          <Pressable
            style={[s.boton, (ocupado || correo.length < 5) && s.botonApagado]}
            disabled={ocupado || correo.length < 5}
            onPress={() => accion(async () => {
              await pedirEnlace(correo);
              setPaso('codigo');
            })}
          >
            <Text style={s.botonTexto}>Enviar código</Text>
          </Pressable>
        </>
      )}

      {paso === 'codigo' && (
        <>
          <Text style={s.titulo}>Escribe el código</Text>
          <Text style={s.suave}>Lo hemos enviado a {correo}.</Text>
          <TextInput
            style={[s.campo, s.campoCodigo]}
            value={codigo}
            onChangeText={setCodigo}
            placeholder="000000"
            placeholderTextColor={tema.color.textoSuave}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            accessibilityLabel="Código de seis dígitos"
          />
          <Pressable
            style={[s.boton, (ocupado || codigo.length < 6) && s.botonApagado]}
            disabled={ocupado || codigo.length < 6}
            onPress={() => accion(async () => {
              const c = await entrarConCodigo(correo, codigo);
              setCuenta(c);
              if (c?.nombre != null && c.nombre.length > 0) onDentro(c);
              else setPaso('nombre');
            })}
          >
            <Text style={s.botonTexto}>Entrar</Text>
          </Pressable>
          <Pressable style={s.secundario} onPress={() => setPaso('correo')}>
            <Text style={s.secundarioTexto}>Cambiar de correo</Text>
          </Pressable>
        </>
      )}

      {paso === 'nombre' && (
        <>
          <Text style={s.titulo}>¿Cómo te llamamos?</Text>
          <Text style={s.suave}>
            Es lo único que van a ver los demás en la clasificación, junto con tu puntuación.
          </Text>
          <TextInput
            style={s.campo}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            placeholderTextColor={tema.color.textoSuave}
            maxLength={40}
            accessibilityLabel="Nombre visible"
          />
          <Pressable
            style={[s.boton, (ocupado || nombre.trim().length === 0) && s.botonApagado]}
            disabled={ocupado || nombre.trim().length === 0}
            onPress={() => accion(async () => {
              await guardarNombre(nombre);
              if (cuenta !== null) onDentro({ ...cuenta, nombre: nombre.trim() });
            })}
          >
            <Text style={s.botonTexto}>Listo</Text>
          </Pressable>
        </>
      )}

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo, padding: tema.espacio.l, justifyContent: 'center' },
  titulo: { ...tema.tipo.titulo, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.l },
  campo: {
    ...tema.tipo.cuerpo,
    color: tema.color.texto,
    backgroundColor: '#1d1f27',
    borderRadius: tema.radio.m,
    paddingHorizontal: tema.espacio.m,
    paddingVertical: tema.espacio.m,
    marginBottom: tema.espacio.m,
  },
  campoCodigo: { fontSize: 26, letterSpacing: 6, textAlign: 'center' },
  boton: {
    backgroundColor: tema.color.marca,
    paddingVertical: tema.espacio.m,
    borderRadius: tema.radio.m,
    alignItems: 'center',
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { paddingVertical: tema.espacio.m, alignItems: 'center' },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  espera: { marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
});
