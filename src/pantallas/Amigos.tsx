import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Pulsable } from '../componentes/Pulsable';
import { Recarga } from '../componentes/Recarga';
import { Selector } from '../componentes/Selector';
import {
  aceptarAmistad,
  buscarPersona,
  FORMATO_USUARIO,
  invitarALiga,
  misAmigos,
  pedirAmistad,
  peticiones,
  quitarAmistad,
  type Amistad,
  type Persona,
} from '../datos/amigos';
import { mensajeDe } from '../datos/errores';
import type { LigaRemota } from '../datos/ligas';
import { HAY_SERVIDOR } from '../datos/supabase';
import { conValores, textos } from '../i18n/textos';
import { tema } from '../tema';

/**
 * Amigos: buscar, aceptar e invitar a una liga.
 *
 * ⭐ Lo que esta pantalla puede y no puede mostrar, que es el principio del esquema:
 * SER ENCONTRABLE NO ES SER VISIBLE. Al buscar a alguien se ve su nombre de usuario, su nombre
 * visible y su inicial. Nunca su puntuacion, ni sus sesiones, ni sus ligas. Los numeros de
 * alguien se ven cuando compartis una liga, no cuando os agregais.
 *
 * ⚠️ La busqueda es por nombre EXACTO, asi que no hay resultados mientras se escribe. Es
 * deliberado: con busqueda parcial se podria recorrer el listado de quien usa la app.
 * La UI lo dice para que no parezca que esta roto.
 *
 * Criterio visual heredado del panel v2: cero bordes de color, jerarquia por tamano
 * tipografico, color solo cuando algo pide atencion.
 */

type Props = {
  /** Para el boton de invitar. Si esta vacio, no se ofrece. */
  ligas: readonly LigaRemota[];
  /** Tocar a un amigo abre su ficha con sus entrenos. */
  onPersona?: (persona: { id: string; nombre: string }) => void;
};

export function Amigos({ ligas, onPersona }: Props) {
  const t = textos();
  const [busqueda, setBusqueda] = useState('');
  const [hallado, setHallado] = useState<Persona | null>(null);
  const [buscado, setBuscado] = useState(false);
  const [amigos, setAmigos] = useState<readonly Amistad[]>([]);
  const [pendientes, setPendientes] = useState<readonly Amistad[]>([]);
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [liga, setLiga] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!HAY_SERVIDOR) return;
    setCargando(true);
    setError(null);
    try {
      const [a, p] = await Promise.all([misAmigos(), peticiones()]);
      setAmigos(a);
      setPendientes(p);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

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

  const puedeBuscar = FORMATO_USUARIO.test(busqueda);
  const recibidas = pendientes.filter((p) => p.direccion === 'recibida');
  const enviadas = pendientes.filter((p) => p.direccion === 'enviada');
  const ligaElegida = ligas.find((l) => l.id === liga) ?? ligas[0] ?? null;

  if (!HAY_SERVIDOR) {
    return (
      <View style={[s.fondo, s.centro]}>
        <Text style={s.titulo}>{t.sinServidor}</Text>
        <Text style={s.suave}>{t.sinServidorTexto}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.fondo}
      contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled"
      // `pegado`: es un modal y el hueco de arriba lo pone el botón de volver de App.tsx, así que
      // el scroll ya empieza por debajo de la isla y bajar la rueda otra vez la mandaría al centro.
      refreshControl={<Recarga pegado cargando={cargando} onRecargar={cargar} />}
    >
      <Text style={s.titulo}>{t.amigos}</Text>

      {/* ── Buscar ─────────────────────────────────────────────────────────── */}
      <View style={s.conArroba}>
        <Text style={s.arroba}>@</Text>
        <TextInput
          style={s.campo}
          value={busqueda}
          onChangeText={(v) => {
            setBusqueda(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
            setHallado(null);
            setBuscado(false);
            setAviso(null);
          }}
          placeholder={t.buscarPlaceholder}
          placeholderTextColor={tema.color.textoSuave}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="search"
          accessibilityLabel={t.buscar}
          onSubmitEditing={() => {
            if (puedeBuscar) {
              void accion(async () => {
                setHallado(await buscarPersona(busqueda));
                setBuscado(true);
              });
            }
          }}
        />
        <Pulsable
          style={[s.botonMini, (!puedeBuscar || ocupado) && s.apagado]}
          disabled={!puedeBuscar || ocupado}
          accessibilityRole="button"
          onPress={() => accion(async () => {
            setHallado(await buscarPersona(busqueda));
            setBuscado(true);
          })}
        >
          <Text style={s.botonMiniTexto}>{t.buscar}</Text>
        </Pulsable>
      </View>
      <Text style={s.pista}>{t.buscarPista}</Text>

      {buscado && hallado === null && <Text style={s.suaveIzq}>{t.noHallado}</Text>}

      {hallado !== null && (
        <View style={s.fila}>
          <View style={s.avatar}>
            <Text style={s.avatarTexto}>{hallado.nombre.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={s.filaMedio}>
            <Text style={s.nombre}>{hallado.nombre}</Text>
            <Text style={s.filaDetalle}>@{hallado.usuario}</Text>
          </View>
          {hallado.relacion === 'ninguna' && (
            <Pulsable
              style={[s.botonMini, ocupado && s.apagado]}
              disabled={ocupado}
              accessibilityRole="button"
              onPress={() => accion(async () => {
                const r = await pedirAmistad(hallado.id);
                setHallado({ ...hallado, relacion: r });
                setAviso(r === 'amigos' ? t.yaSoisAmigos : t.peticionEnviada);
                await cargar();
              })}
            >
              <Text style={s.botonMiniTexto}>{t.agregar}</Text>
            </Pulsable>
          )}
          {hallado.relacion === 'enviada' && <Text style={s.filaEstado}>{t.pendiente}</Text>}
          {hallado.relacion === 'amigos' && <Text style={s.filaEstado}>{t.yaAmigos}</Text>}
          {hallado.relacion === 'yo' && <Text style={s.filaEstado}>{t.eresTu}</Text>}
          {hallado.relacion === 'recibida' && (
            <Pulsable
              style={[s.botonMini, ocupado && s.apagado]}
              disabled={ocupado}
              accessibilityRole="button"
              onPress={() => accion(async () => {
                await aceptarAmistad(hallado.id);
                setHallado({ ...hallado, relacion: 'amigos' });
                await cargar();
              })}
            >
              <Text style={s.botonMiniTexto}>{t.aceptar}</Text>
            </Pulsable>
          )}
        </View>
      )}

      {aviso !== null && <Text style={s.aviso}>{aviso}</Text>}

      {/* ── Peticiones recibidas ───────────────────────────────────────────── */}
      {recibidas.length > 0 && (
        <>
          <Text style={s.seccion}>{t.teHanAgregado}</Text>
          {recibidas.map((p) => (
            <View key={p.id} style={s.fila}>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>{p.nombre.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={s.filaMedio}>
                <Text style={s.nombre}>{p.nombre}</Text>
                <Text style={s.filaDetalle}>@{p.usuario}</Text>
              </View>
              <Pulsable
                style={[s.botonMini, ocupado && s.apagado]}
                disabled={ocupado}
                accessibilityRole="button"
                onPress={() => accion(async () => {
                  await aceptarAmistad(p.id);
                  await cargar();
                })}
              >
                <Text style={s.botonMiniTexto}>{t.aceptar}</Text>
              </Pulsable>
              <Pulsable
                style={s.rechazar}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`${t.no} · ${p.nombre}`}
                onPress={() => accion(async () => {
                  await quitarAmistad(p.id);
                  await cargar();
                })}
              >
                <Text style={s.rechazarTexto}>{t.no}</Text>
              </Pulsable>
            </View>
          ))}
        </>
      )}

      {/* ── Lista de amigos ────────────────────────────────────────────────── */}
      <Text style={s.seccion}>{amigos.length === 0 ? t.sinAmigos : t.tusAmigos}</Text>

      {/*
        ⚠️ Elegir liga ANTES de invitar. La primera version invitaba siempre a `ligas[0]` sin
        decir a cual, asi que con dos ligas el boton metia gente en la equivocada sin avisar.
        Con una sola liga no se pinta el selector: seria una decision falsa.

        ⭐ Con `Selector`, no con tiras horizontales: es el patron que ya se retiro en Ligas
        porque con 8 ligas las ultimas quedaban fuera del borde. Aqui seguia la copia vieja.
      */}
      {amigos.length > 0 && ligas.length > 1 && (
        <View style={s.selectorLiga}>
          <Selector
            etiqueta={t.invitarA}
            valor={ligaElegida?.id ?? ligas[0].id}
            onCambio={setLiga}
            opciones={ligas.map((l) => ({ id: l.id, nombre: l.nombre }))}
          />
        </View>
      )}

      {amigos.length === 0 && <Text style={s.suaveIzq}>{t.sinAmigosTexto}</Text>}

      {amigos.map((a) => (
        <View key={a.id} style={s.fila}>
          {/* La persona es pulsable: abre su ficha con sus entrenos. El botón de invitar, aparte. */}
          <Pulsable
            fila
            style={s.filaPersona}
            onPress={() => onPersona?.({ id: a.id, nombre: a.nombre })}
            disabled={onPersona === undefined}
            accessibilityRole="button"
            accessibilityLabel={a.nombre}
          >
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{a.nombre.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={s.filaMedio}>
              <Text style={s.nombre}>{a.nombre}</Text>
              <Text style={s.filaDetalle}>@{a.usuario}</Text>
            </View>
          </Pulsable>
          {ligaElegida !== null && (
            <Pulsable
              style={[s.botonMini, ocupado && s.apagado]}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel={`${t.invitar} · ${a.nombre} · ${ligaElegida.nombre}`}
              onPress={() => accion(async () => {
                await invitarALiga(ligaElegida.id, a.id);
                setAviso(conValores(t.entraEn, { quien: a.nombre, liga: ligaElegida.nombre }));
              })}
            >
              <Text style={s.botonMiniTexto}>{t.invitar}</Text>
            </Pulsable>
          )}
        </View>
      ))}

      {/* ── Enviadas, al final porque no hay nada que hacer con ellas ───────── */}
      {enviadas.length > 0 && (
        <>
          <Text style={s.seccion}>{t.esperandoRespuesta}</Text>
          {enviadas.map((p) => (
            <View key={p.id} style={s.fila}>
              <View style={s.filaMedio}>
                <Text style={s.filaDetalle}>@{p.usuario}</Text>
              </View>
              <Pulsable
                style={s.rechazar}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`${t.retirar} · ${p.usuario}`}
                onPress={() => accion(async () => {
                  await quitarAmistad(p.id);
                  await cargar();
                })}
              >
                <Text style={s.rechazarTexto}>{t.retirar}</Text>
              </Pulsable>
            </View>
          ))}
        </>
      )}

      {ocupado && <ActivityIndicator color={tema.color.marca} style={s.espera} />}
      {error !== null && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  // Sin paddingTop de area segura: el boton de volver de App.tsx ya lo aporta.
  contenido: { padding: tema.espacio.l, paddingBottom: tema.espacio.xl * 2 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ⭐ Título de PANTALLA, 22px: "Amigos" es una pantalla de tarea sin cifra protagonista.
  titulo: { ...tema.tipo.tituloPantalla, color: tema.color.texto, marginBottom: tema.espacio.m },
  seccion: {
    ...tema.tipo.seccion,
    color: tema.color.textoSuave,
    marginTop: tema.espacio.l,
    marginBottom: tema.espacio.s,
  },
  suave: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, textAlign: 'center' },
  suaveIzq: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginBottom: tema.espacio.s },
  pista: { ...tema.tipo.detalle, color: tema.color.textoSuave, marginBottom: tema.espacio.m },
  conArroba: { flexDirection: 'row', alignItems: 'center', marginBottom: tema.espacio.s },
  arroba: { ...tema.tipo.cuerpo, color: tema.color.textoSuave, marginRight: tema.espacio.xs },
  // El desplegable de "invitar a", alineado a la izquierda con su hueco propio.
  selectorLiga: { alignSelf: 'flex-start', marginBottom: tema.espacio.m },
  campo: {
    ...tema.tipo.cuerpo,
    flex: 1,
    minHeight: tema.tactil,
    color: tema.color.texto,
    backgroundColor: tema.color.superficie,
    borderRadius: tema.radio.m,
    paddingHorizontal: tema.espacio.m,
    paddingVertical: tema.espacio.s + 2,
  },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: tema.espacio.s },
  // La parte pulsable de la fila de un amigo: avatar y nombre, ocupando lo que no es el botón.
  filaPersona: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: tema.tactil },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tema.color.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tema.espacio.s + 2,
  },
  avatarTexto: { ...tema.tipo.detalle, color: tema.color.marca, fontWeight: '600' },
  filaMedio: { flex: 1 },
  nombre: { ...tema.tipo.cuerpo, color: tema.color.texto },
  filaDetalle: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  filaEstado: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  // ⚠️ 44 de alto minimo: es lo que pide la guia de Apple para un objetivo tactil. Con el
  // padding de antes salian 32 y fallaban los dedos gordos.
  botonMini: {
    backgroundColor: tema.color.marca,
    minHeight: tema.tactil,
    justifyContent: 'center',
    paddingHorizontal: tema.espacio.m,
    borderRadius: tema.radio.s,
    marginLeft: tema.espacio.s,
  },
  botonMiniTexto: { ...tema.tipo.detalle, color: tema.color.fondo, fontWeight: '600' },
  apagado: { opacity: 0.4 },
  rechazar: {
    minHeight: tema.tactil,
    minWidth: tema.tactil,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tema.espacio.xs,
  },
  rechazarTexto: { ...tema.tipo.detalle, color: tema.color.textoSuave },
  aviso: { ...tema.tipo.detalle, color: tema.color.marca, marginTop: tema.espacio.s },
  error: { ...tema.tipo.detalle, color: tema.color.bajo, marginTop: tema.espacio.m },
  espera: { marginVertical: tema.espacio.m },
});
