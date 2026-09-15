/**
 * Almacenamiento local. Todo lo que la app necesita recordar entre arranques.
 *
 * Por que existe una interfaz en vez de llamar a AsyncStorage directamente: AsyncStorage es
 * un modulo nativo, asi que los tests del motor no podrian correr en Windows. Con la interfaz
 * los tests usan el almacen en memoria y la app usa el nativo, sin cambiar la logica.
 */

export type Almacen = {
  leer(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
};

/** Todas las claves en un sitio, para que el borrado de cuenta no se deje ninguna. */
export const CLAVES = {
  /** Anchor de HealthKit por tipo de dato. */
  anchor: (tipo: string) => `anchor:${tipo}`,
  /** Esfuerzo declarado de una sesion. */
  esfuerzo: (idSesion: string) => `rpe:${idSesion}`,
  /** Deporte corregido a mano de una sesion. */
  deporte: (idSesion: string) => `deporte:${idSesion}`,
  /** Ultimo maximo de referencia calculado, para no releer 90 dias en cada arranque. */
  maximo: 'maximo',
  /** Que tipos de HealthKit tienen entrega en segundo plano configurada, con version. */
  observador: 'observador',
  /** La cuenta propia tal y como se leyo por ultima vez del servidor. Ver `leeCuenta`. */
  cuenta: 'cuenta',
  /**
   * Celebracion ya mostrada. La clave lleva el momento y su periodo (`oms:2026-09-07`), asi
   * cada logro se celebra UNA vez: una celebracion que reaparece cada vez que abres la app
   * deja de significar nada, que es lo contrario de lo que existe para hacer.
   */
  celebracion: (momento: string) => `celebrado:${momento}`,
} as const;

/** Implementacion en memoria. Para tests y para el primer arranque antes del rebuild. */
export function almacenEnMemoria(inicial: Record<string, string> = {}): Almacen & {
  volcado(): Record<string, string>;
} {
  const datos = new Map(Object.entries(inicial));
  return {
    async leer(clave) {
      return datos.get(clave) ?? null;
    },
    async guardar(clave, valor) {
      datos.set(clave, valor);
    },
    async borrar(clave) {
      datos.delete(clave);
    },
    volcado() {
      return Object.fromEntries(datos);
    },
  };
}

async function leerJson<T>(almacen: Almacen, clave: string): Promise<T | null> {
  const bruto = await almacen.leer(clave);
  if (bruto === null) return null;
  try {
    return JSON.parse(bruto) as T;
  } catch {
    // Un valor corrupto no debe tumbar la app. Se trata como si no estuviera.
    return null;
  }
}

/**
 * Anchor de HealthKit.
 *
 * ⭐ Es la pieza que evita huecos en el leaderboard. `queryQuantitySamplesWithAnchor` devuelve
 * solo lo que cambio, lo que se borro y un anchor nuevo. Si un aviso de segundo plano se
 * pierde, el siguiente recupera lo pendiente.
 *
 * Regla: en segundo plano se lee con anchor y se cachea. Nunca se recalcula el historico.
 */
export async function leeAnchor(almacen: Almacen, tipo: string): Promise<string | null> {
  return almacen.leer(CLAVES.anchor(tipo));
}

export async function guardaAnchor(
  almacen: Almacen,
  tipo: string,
  anchor: string,
): Promise<void> {
  await almacen.guardar(CLAVES.anchor(tipo), anchor);
}

/**
 * Esfuerzo declarado, el s-RPE de 1 a 10.
 *
 * Este dato lo genera la app y NO existe en HealthKit, asi que sin guardarlo el deslizador no
 * sirve de nada. Se indexa por el id de la sesion fusionada.
 *
 * Validez 0,88 contra TRIMP, validado en ballet profesional, que es el analogo de barre mas
 * cercano publicado. No es un parche, es la alternativa reconocida cuando no hay pulso.
 */
export async function leeEsfuerzo(
  almacen: Almacen,
  idSesion: string,
): Promise<number | null> {
  const v = await almacen.leer(CLAVES.esfuerzo(idSesion));
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

export async function guardaEsfuerzo(
  almacen: Almacen,
  idSesion: string,
  rpe: number,
): Promise<void> {
  const acotado = Math.max(1, Math.min(10, Math.round(rpe)));
  await almacen.guardar(CLAVES.esfuerzo(idSesion), String(acotado));
}

/** Esfuerzos de varias sesiones de una vez, para no encadenar lecturas. */
export async function leeEsfuerzos(
  almacen: Almacen,
  ids: readonly string[],
): Promise<Record<string, number>> {
  const pares = await Promise.all(
    ids.map(async (id) => [id, await leeEsfuerzo(almacen, id)] as const),
  );
  return Object.fromEntries(pares.filter(([, v]) => v !== null) as [string, number][]);
}

/**
 * Deporte corregido a mano de una sesion.
 *
 * ⭐ Existe porque Fitbit escribe algunas sesiones en Apple Health como "otro" (codigo 3000)
 * aunque en su app tengan deporte: medido con las pesas del usuario el 8 sep. El dato llega
 * roto de origen, asi que se corrige aqui y la correccion sobrevive a cada relectura de
 * HealthKit. Mismo patron que el esfuerzo declarado: clave por id de la sesion fusionada.
 *
 * El valor se guarda tal cual y se valida al APLICAR (`esTipoDeporte` en sincroniza): asi un
 * valor viejo de una version futura no revienta esta, simplemente se ignora.
 */
export async function guardaDeporte(
  almacen: Almacen,
  idSesion: string,
  tipo: string,
): Promise<void> {
  await almacen.guardar(CLAVES.deporte(idSesion), tipo);
}

/** Deportes corregidos de varias sesiones de una vez. Solo devuelve los que existen. */
export async function leeDeportes(
  almacen: Almacen,
  ids: readonly string[],
): Promise<Record<string, string>> {
  const pares = await Promise.all(
    ids.map(async (id) => [id, await almacen.leer(CLAVES.deporte(id))] as const),
  );
  return Object.fromEntries(pares.filter(([, v]) => v !== null) as [string, string][]);
}

export type MaximoGuardado = {
  valor: number;
  provisional: boolean;
  /** Cuando se calculo, en milisegundos. */
  calculado: number;
};

/** Se recalcula cada semana, o antes si venia provisional. */
export const CADUCIDAD_MAXIMO = 7 * 86_400_000;

export async function leeMaximo(almacen: Almacen): Promise<MaximoGuardado | null> {
  const m = await leerJson<MaximoGuardado>(almacen, CLAVES.maximo);
  if (m === null) return null;
  const caduco = Date.now() - m.calculado > CADUCIDAD_MAXIMO;
  // Un maximo provisional se reintenta en cada arranque: en cuanto la persona apriete una vez,
  // el percentil pasa a ser creible y las intensidades dejan de estar aplanadas.
  return caduco || m.provisional ? null : m;
}

export async function guardaMaximo(
  almacen: Almacen,
  maximo: { valor: number; provisional: boolean },
): Promise<void> {
  await almacen.guardar(
    CLAVES.maximo,
    JSON.stringify({ ...maximo, calculado: Date.now() } satisfies MaximoGuardado),
  );
}

/**
 * La cuenta propia, tal y como se leyo del servidor la ultima vez. Misma forma que `Cuenta` en
 * `cuenta.ts`; se declara aqui aparte para que este fichero no importe nada y siga siendo puro.
 */
export type CuentaGuardada = {
  id: string;
  correo: string | null;
  nombre: string | null;
  usuario: string | null;
};

/**
 * ⭐ Copia local de la cuenta, para arrancar sin red.
 *
 * Existe por un fallo real: al arrancar, un fallo de red al leer el perfil se confundia con
 * "esta persona no tiene perfil" y la app mandaba a alguien con cuenta a la pantalla de alta.
 * supabase-js ya guarda la SESION en el telefono; el perfil (nombre y usuario) no lo guardaba
 * nadie, asi que sin servidor no habia forma de saber quien eres. Ahora, si hay sesion guardada
 * y el servidor no responde, la app arranca con lo ultimo que supo de ti y la red se reintenta
 * sola en la siguiente consulta.
 *
 * Se escribe cada vez que el perfil se lee o se cambia con exito, y se olvida al cerrar sesion
 * (el borrado de cuenta lo barre `borrarTodoLocal`). Si se pasa `id`, la copia solo vale si es
 * de esa misma persona: una copia de otra cuenta en el mismo telefono no se devuelve nunca.
 */
export async function leeCuenta(almacen: Almacen, id?: string): Promise<CuentaGuardada | null> {
  const c = await leerJson<Partial<CuentaGuardada>>(almacen, CLAVES.cuenta);
  if (c === null || typeof c.id !== 'string' || c.id.length === 0) return null;
  if (id !== undefined && c.id !== id) return null;
  return {
    id: c.id,
    correo: typeof c.correo === 'string' ? c.correo : null,
    nombre: typeof c.nombre === 'string' ? c.nombre : null,
    usuario: typeof c.usuario === 'string' ? c.usuario : null,
  };
}

export async function guardaCuenta(almacen: Almacen, cuenta: CuentaGuardada): Promise<void> {
  await almacen.guardar(CLAVES.cuenta, JSON.stringify(cuenta));
}

/**
 * Actualiza nombre o usuario en la copia local tras cambiarlos en el servidor. Si no habia
 * copia no inventa una: sin id no hay a quien atribuirsela, y la siguiente lectura con red la
 * escribe entera.
 */
export async function actualizaCuenta(
  almacen: Almacen,
  cambios: Partial<Pick<CuentaGuardada, 'nombre' | 'usuario'>>,
): Promise<void> {
  const actual = await leeCuenta(almacen);
  if (actual === null) return;
  await guardaCuenta(almacen, { ...actual, ...cambios });
}

export async function olvidaCuenta(almacen: Almacen): Promise<void> {
  await almacen.borrar(CLAVES.cuenta);
}

/** ¿Se celebró ya este momento? El id lleva el periodo dentro (`oms:2026-09-07`). */
export async function yaCelebrado(almacen: Almacen, momento: string): Promise<boolean> {
  return (await almacen.leer(CLAVES.celebracion(momento))) !== null;
}

export async function marcaCelebrado(almacen: Almacen, momento: string): Promise<void> {
  await almacen.guardar(CLAVES.celebracion(momento), '1');
}
