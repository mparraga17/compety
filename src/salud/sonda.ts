import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';

import { preparar } from './permisos';
import { TIPOS_A_LEER, type TipoLeible } from './tipos';

/**
 * Sonda de permisos, tipo por tipo.
 *
 * Existe porque iOS no dice qué concedió el usuario en lectura: si falta el permiso, la
 * consulta devuelve vacío igual que si no hubiera datos. La única forma de acercarse es
 * consultar cada tipo por separado y ver el patrón.
 *
 * Cómo se lee el resultado:
 *   TODOS a 0        el permiso global falló, o requestAuthorization no llegó a resolver
 *   unos sí, otros 0 los que están a 0 no tienen permiso, o no tienen datos
 */

export type Sonda = {
  tipo: TipoLeible;
  muestras: number;
  ultima: Date | null;
  error: string | null;
};

/** Tipos de cantidad, los únicos que se pueden sondear con queryQuantitySamples. */
const SONDEABLES = TIPOS_A_LEER.filter(
  (t) => t.startsWith('HKQuantityTypeIdentifier'),
) as readonly TipoLeible[];

export async function sondea(dias = 30): Promise<readonly Sonda[]> {
  await preparar();

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const resultados: Sonda[] = [];

  for (const tipo of SONDEABLES) {
    try {
      const muestras = await queryQuantitySamples(
        tipo as 'HKQuantityTypeIdentifierStepCount',
        { limit: 0, filter: { date: { startDate: desde } }, ascending: false },
      );
      resultados.push({
        tipo,
        muestras: muestras.length,
        ultima: muestras.length > 0 ? muestras[0].startDate : null,
        error: null,
      });
    } catch (e) {
      resultados.push({
        tipo,
        muestras: 0,
        ultima: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return resultados;
}

/** Nombre corto para la interfaz. */
export function nombreCorto(tipo: string): string {
  return tipo
    .replace('HKQuantityTypeIdentifier', '')
    .replace('HKCategoryTypeIdentifier', '')
    .replace('HKWorkoutTypeIdentifier', 'Workout');
}
