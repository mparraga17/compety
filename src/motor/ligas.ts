import type { TipoDeporte } from './met';

/**
 * Ligas: cada una agrupa deportes con perfil fisiologico comparable.
 *
 * ⭐ Corregido por el usuario el 26 ago: "Como que el golf no debe sumar a la liga general?
 * yo creo que si pero debe tener sus pesos en funcion de la carga del ejercicio." Tenia
 * razon, excluir un deporte era la salida perezosa. TODAS las ligas suman a la general.
 * Lo que equilibra el ranking son los pesos por MET y la compresion del volumen.
 *
 * Padel y tenis van separados, tambien por correccion suya, y con motivo publicado: la
 * literatura advierte de no agrupar deportes de raqueta (badminton 182 lpm frente a tenis de
 * mesa 104) y el Compendium les da MET distintos, 6,8 frente a 8,0.
 */

export type IdLiga =
  | 'global'
  | 'padel'
  | 'tenis'
  | 'correr'
  | 'estudio'
  | 'fuerza'
  | 'golf'
  | 'paseo';

export type Liga = {
  id: IdLiga;
  /** Clave de i18n. El nombre visible NUNCA se guarda dentro del dato. */
  clave: string;
  /** null en la general: acepta cualquier deporte. */
  tipos: readonly TipoDeporte[] | null;
};

export const LIGAS: Record<IdLiga, Liga> = {
  global: { id: 'global', clave: 'liga.global', tipos: null },
  padel: { id: 'padel', clave: 'liga.padel', tipos: ['PADEL'] },
  tenis: { id: 'tenis', clave: 'liga.tenis', tipos: ['TENNIS', 'BADMINTON', 'SQUASH'] },
  correr: { id: 'correr', clave: 'liga.correr', tipos: ['RUNNING', 'TRAIL_RUNNING', 'TREADMILL'] },
  estudio: { id: 'estudio', clave: 'liga.estudio', tipos: ['BARRE', 'PILATES', 'YOGA', 'DANCE'] },
  fuerza: {
    id: 'fuerza',
    clave: 'liga.fuerza',
    tipos: ['STRENGTH_TRAINING', 'WORKOUT', 'CIRCUIT_TRAINING'],
  },
  golf: { id: 'golf', clave: 'liga.golf', tipos: ['GOLF'] },
  paseo: { id: 'paseo', clave: 'liga.paseo', tipos: ['WALKING', 'HIKING'] },
};

/** Ligas de deporte, sin la general. Es el orden en que se muestran. */
export const LIGAS_DEPORTE: readonly IdLiga[] = [
  'padel',
  'tenis',
  'correr',
  'estudio',
  'fuerza',
  'golf',
  'paseo',
];

/** Liga a la que pertenece un deporte. null si no encaja en ninguna. */
export function ligaDe(tipo: string | null | undefined): IdLiga | null {
  if (tipo == null) return null;
  for (const liga of Object.values(LIGAS)) {
    if (liga.tipos?.includes(tipo as TipoDeporte)) return liga.id;
  }
  return null;
}

/** Si una sesion entra en una liga. La general acepta todo. */
export function entraEnLiga(tipo: string | null | undefined, liga: IdLiga): boolean {
  if (liga === 'global') return true;
  return ligaDe(tipo) === liga;
}
