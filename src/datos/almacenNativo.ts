import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Almacen } from './almacen';

/**
 * Almacen sobre AsyncStorage.
 *
 * Vive aparte de `almacen.ts` a proposito: AsyncStorage es un modulo nativo, asi que si lo
 * importara el fichero de la interfaz los tests del motor no podrian correr en Windows. Con
 * esta separacion los tests usan el almacen en memoria y la app este.
 */

const PREFIJO = 'compety:';

export function almacenNativo(): Almacen {
  return {
    async leer(clave) {
      return AsyncStorage.getItem(PREFIJO + clave);
    },
    async guardar(clave, valor) {
      await AsyncStorage.setItem(PREFIJO + clave, valor);
    },
    async borrar(clave) {
      await AsyncStorage.removeItem(PREFIJO + clave);
    },
  };
}

/**
 * Borra todo lo local. Se llama al borrar la cuenta, que Apple exige dentro de la app.
 * Recorre las claves con el prefijo para no tocar lo que guarde Supabase de la sesion.
 */
export async function borrarTodoLocal(): Promise<void> {
  const claves = await AsyncStorage.getAllKeys();
  const mias = claves.filter((k) => k.startsWith(PREFIJO));
  if (mias.length > 0) await AsyncStorage.multiRemove(mias);
}
