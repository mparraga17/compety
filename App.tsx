import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { registrarSegundoPlano } from './src/avisos/segundoPlano';
import { guardarToken, prepararCanal, prepararPush } from './src/avisos/push';
import { sesionActual, type Cuenta } from './src/datos/cuenta';
import { misLigas, type LigaRemota } from './src/datos/ligas';
import { HAY_SERVIDOR } from './src/datos/supabase';
import { Bienvenida } from './src/pantallas/Bienvenida';
import { Entrar } from './src/pantallas/Entrar';
import { Ligas } from './src/pantallas/Ligas';
import { NuevaLiga } from './src/pantallas/NuevaLiga';
import { estadoPermisos } from './src/salud/permisos';
import { tema } from './src/tema';

/**
 * Flujo de arranque.
 *
 * 1. Permisos de salud. Antes de la hoja del sistema va la bienvenida, que explica que se lee
 *    y para que. Requisito de Apple: rechazan apps que usan HealthKit sin identificar la
 *    funcion en la interfaz.
 * 2. Cuenta, solo si hay servidor. Sin cuenta la app calcula tu puntuacion pero no hay con
 *    quien compararla.
 * 3. Ligas.
 *
 * Los avisos push y el segundo plano se preparan una vez dentro, no en el arranque, para no
 * apilar tres hojas de permiso del sistema seguidas.
 */

type Fase = 'comprobando' | 'bienvenida' | 'entrar' | 'ligas' | 'crear-liga' | 'entrar-liga';

export default function App() {
  const [fase, setFase] = useState<Fase>('comprobando');
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [ligas, setLigas] = useState<readonly LigaRemota[]>([]);

  const cargarLigas = useCallback(async () => {
    try {
      setLigas(await misLigas());
    } catch {
      setLigas([]);
    }
  }, []);

  // Arranque: permisos de salud y sesion.
  useEffect(() => {
    (async () => {
      let permisos = false;
      try {
        permisos = (await estadoPermisos()).tipo === 'preguntado';
      } catch {
        permisos = false;
      }
      if (!permisos) {
        setFase('bienvenida');
        return;
      }

      if (!HAY_SERVIDOR) {
        setFase('ligas');
        return;
      }

      const c = await sesionActual().catch(() => null);
      if (c === null || c.nombre === null) {
        setFase('entrar');
        return;
      }
      setCuenta(c);
      await cargarLigas();
      setFase('ligas');
    })();
  }, [cargarLigas]);

  // Push y segundo plano, una vez ya hay cuenta y liga. Se piden aqui y no antes para no
  // encadenar hojas de permiso del sistema en el primer arranque.
  useEffect(() => {
    if (fase !== 'ligas' || cuenta === null) return;
    (async () => {
      await prepararCanal();
      const estado = await prepararPush();
      if (estado.tipo === 'listo') {
        await guardarToken(estado.token).catch(() => undefined);
      }
      await registrarSegundoPlano();
    })();
  }, [fase, cuenta]);

  async function entrarDentro(c: Cuenta) {
    setCuenta(c);
    await cargarLigas();
    setFase('ligas');
  }

  return (
    <View style={s.fondo}>
      <StatusBar style="light" />

      {fase === 'comprobando' && (
        <View style={s.centro}>
          <ActivityIndicator color={tema.color.marca} />
        </View>
      )}

      {fase === 'bienvenida' && (
        <Bienvenida
          onListo={() => setFase(HAY_SERVIDOR ? 'entrar' : 'ligas')}
          onSaltar={() => setFase(HAY_SERVIDOR ? 'entrar' : 'ligas')}
        />
      )}

      {fase === 'entrar' && <Entrar onDentro={(c) => void entrarDentro(c)} />}

      {fase === 'ligas' && (
        <Ligas
          ligas={ligas}
          yo={cuenta?.id ?? null}
          onCrear={() => setFase('crear-liga')}
          onEntrar={() => setFase('entrar-liga')}
        />
      )}

      {(fase === 'crear-liga' || fase === 'entrar-liga') && (
        <NuevaLiga
          modo={fase === 'crear-liga' ? 'crear' : 'entrar'}
          onHecho={() => {
            void cargarLigas();
            setFase('ligas');
          }}
          onCancelar={() => setFase('ligas')}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: tema.color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
