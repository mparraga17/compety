import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { crearLiga, entrarEnLiga } from '../datos/ligas';
import { nombreLiga } from '../i18n/ligas';
import { idiomaDelSistema } from '../i18n/textos';
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

type Props = { modo: 'crear' | 'entrar'; onHecho: () => void; onCancelar: () => void };

export function NuevaLiga({ modo, onHecho, onCancelar }: Props) {
  const idioma = idiomaDelSistema();
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState<IdLiga | null>(null);
  const [codigo, setCodigo] = useState('');
  const [creada, setCreada] = useState<{ codigo: string } | null>(null);
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

  if (creada !== null) {
    return (
      <View style={s.fondo}>
        <Text style={s.titulo}>Liga creada</Text>
        <Text style={s.suave}>
          Pásale este código a quien quieras que entre. Sin código no se puede ver la liga.
        </Text>
        <Text style={s.codigo}>{creada.codigo}</Text>
        <Pressable
          style={s.boton}
          onPress={() =>
            void Share.share({
              message: `Entra en mi liga de Compety con el código ${creada.codigo}`,
            })
          }
        >
          <Text style={s.botonTexto}>Compartir el código</Text>
        </Pressable>
        <Pressable style={s.secundario} onPress={onHecho}>
          <Text style={s.secundarioTexto}>Ver la clasificación</Text>
        </Pressable>
      </View>
    );
  }

  if (modo === 'entrar') {
    return (
      <View style={s.fondo}>
        <Text style={s.titulo}>Entrar en una liga</Text>
        <Text style={s.suave}>Escribe el código de seis caracteres que te han pasado.</Text>
        <TextInput
          style={[s.campo, s.campoCodigo]}
          value={codigo}
          onChangeText={(t) => setCodigo(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={tema.color.textoSuave}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          accessibilityLabel="Código de la liga"
        />
        <Pressable
          style={[s.boton, (ocupado || codigo.length < 6) && s.botonApagado]}
          disabled={ocupado || codigo.length < 6}
          onPress={() => accion(async () => {
            await entrarEnLiga(codigo);
            onHecho();
          })}
        >
          <Text style={s.botonTexto}>Entrar</Text>
        </Pressable>
        <Pressable style={s.secundario} onPress={onCancelar}>
          <Text style={s.secundarioTexto}>Cancelar</Text>
        </Pressable>
        {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
        {error !== null && <Text style={s.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={s.fondo} contentContainerStyle={s.contenido}>
      <Text style={s.titulo}>Crear una liga</Text>
      <Text style={s.suave}>
        Ponle nombre y elige si compite en todo o en un deporte concreto.
      </Text>

      <TextInput
        style={s.campo}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Los del jueves"
        placeholderTextColor={tema.color.textoSuave}
        maxLength={40}
        accessibilityLabel="Nombre de la liga"
      />

      <Text style={s.seccion}>Deporte</Text>
      <Pressable style={s.opcion} onPress={() => setDeporte(null)}>
        <Text style={[s.opcionTexto, deporte === null && s.opcionActiva]}>
          {nombreLiga('global', idioma)}
        </Text>
        {deporte === null && <View style={s.punto} />}
      </Pressable>
      <Text style={s.nota}>
        En la general puntúa cualquier actividad. Una clase de barre puede sumar más que una
        carrera tranquila.
      </Text>

      {LIGAS_DEPORTE.map((id) => (
        <Pressable key={id} style={s.opcion} onPress={() => setDeporte(id)}>
          <Text style={[s.opcionTexto, deporte === id && s.opcionActiva]}>
            {nombreLiga(id, idioma)}
          </Text>
          {deporte === id && <View style={s.punto} />}
        </Pressable>
      ))}

      <Pressable
        style={[s.boton, (ocupado || nombre.trim().length === 0) && s.botonApagado]}
        disabled={ocupado || nombre.trim().length === 0}
        onPress={() => accion(async () => {
          const r = await crearLiga(nombre, deporte);
          setCreada({ codigo: r.codigo });
        })}
      >
        <Text style={s.botonTexto}>Crear</Text>
      </Pressable>
      <Pressable style={s.secundario} onPress={onCancelar}>
        <Text style={s.secundarioTexto}>Cancelar</Text>
      </Pressable>

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo, padding: tema.espacio.l },
  contenido: { paddingBottom: tema.espacio.xl },
  titulo: { ...tema.tipo.titulo, color: tema.color.texto, marginBottom: tema.espacio.s },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.l },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.m,
    marginBottom: tema.espacio.s,
  },
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
  opcion: { flexDirection: 'row', alignItems: 'center', paddingVertical: tema.espacio.s + 2 },
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
    paddingVertical: tema.espacio.m,
    borderRadius: tema.radio.m,
    alignItems: 'center',
    marginTop: tema.espacio.m,
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...tema.tipo.cuerpo, color: tema.color.fondo, fontWeight: '600' },
  secundario: { paddingVertical: tema.espacio.m, alignItems: 'center' },
  secundarioTexto: { ...tema.tipo.cuerpo, color: tema.color.marca },
  espera: { marginTop: tema.espacio.m },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
});
