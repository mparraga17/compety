/**
 * Catálogo curado de distritos por ciudad, más la fusión con las zonas vivas del servidor.
 *
 * ⭐ Es la tercera pata del embudo de zona (decisión del usuario, 8 sep):
 *
 *   GPS        → rellena ciudad y preselecciona distrito (si el build lo trae)
 *   catálogo   → los distritos OFICIALES de las ciudades grandes, y las ciudades grandes
 *   servidor   → los distritos y ciudades que otra gente ya creó, aunque no
 *                estén en el catálogo (pueblos, barrios no oficiales)
 *   escribir   → el buscador filtra con cada letra, y si lo tuyo no aparece, lo
 *                tecleado vale tal cual (fila «Usar…», patrón `addCustomItem` de
 *                react-native-dropdown-picker, verificado con el GitHub MCP)
 *
 * El motivo es la fragmentación: con texto libre, «Chamberí», «chamberi» y «Chamberí,
 * Madrid» serían tres ligas distintas, y el arranque en frío ya es el riesgo nº1. Un
 * desplegable converge por construcción. Es el patrón del NeighborhoodPicker coreano
 * verificado con el GitHub MCP: lista agrupada primero, GPS como atajo, búsqueda encima.
 *
 * ⚠️ Los nombres van con sus acentos y grafía oficial. La clave de búsqueda se normaliza
 * (minúsculas y sin acentos) para que «madrid» y «MADRID» encuentren lo mismo.
 */

/** Distritos oficiales. Fuente: división administrativa de cada ayuntamiento. */
const CATALOGO: Record<string, readonly string[]> = {
  madrid: [
    'Arganzuela', 'Barajas', 'Carabanchel', 'Centro', 'Chamartín', 'Chamberí',
    'Ciudad Lineal', 'Fuencarral-El Pardo', 'Hortaleza', 'Latina', 'Moncloa-Aravaca',
    'Moratalaz', 'Puente de Vallecas', 'Retiro', 'Salamanca', 'San Blas-Canillejas',
    'Tetuán', 'Usera', 'Vicálvaro', 'Villa de Vallecas', 'Villaverde',
  ],
  barcelona: [
    'Ciutat Vella', 'Eixample', 'Gràcia', 'Horta-Guinardó', 'Les Corts', 'Nou Barris',
    'Sant Andreu', 'Sant Martí', 'Sants-Montjuïc', 'Sarrià-Sant Gervasi',
  ],
  valencia: [
    'Algirós', 'Benicalap', 'Benimaclet', 'Campanar', 'Camins al Grau', 'Ciutat Vella',
    'El Pla del Real', 'Extramurs', 'Jesús', 'La Saïdia', "L'Eixample", "L'Olivereta",
    'Patraix', 'Poblats Marítims', 'Quatre Carreres', 'Rascanya',
  ],
  sevilla: [
    'Bellavista-La Palmera', 'Casco Antiguo', 'Cerro-Amate', 'Este-Alcosa-Torreblanca',
    'Los Remedios', 'Macarena', 'Nervión', 'Norte', 'San Pablo-Santa Justa', 'Sur',
    'Triana',
  ],
  zaragoza: [
    'Actur-Rey Fernando', 'Casablanca', 'Casco Histórico', 'Centro', 'Delicias',
    'El Rabal', 'La Almozara', 'Las Fuentes', 'Miralbueno', 'Oliver-Valdefierro',
    'San José', 'Santa Isabel', 'Torrero-La Paz', 'Universidad',
  ],
  // Ciudad de México: las 16 alcaldías.
  'ciudad de mexico': [
    'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa',
    'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras',
    'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza',
    'Xochimilco',
  ],
};

/** Alias que el GPS o la gente usan para la misma ciudad. */
const ALIAS: Record<string, string> = {
  cdmx: 'ciudad de mexico',
  'mexico city': 'ciudad de mexico',
  'méxico d.f.': 'ciudad de mexico',
  valència: 'valencia',
};

/**
 * Clave de búsqueda: minúsculas, sin acentos y sin espacios sobrantes.
 *
 * ⚠️ `normalize` es ES6 y Hermes lo trae (la regla de este proyecto veta `Intl`, no esto).
 * El guard existe por si algún motor viejo no lo implementa: mejor una clave con acentos
 * que un crash.
 */
export function claveDeCiudad(ciudad: string): string {
  const base = ciudad.trim().toLowerCase();
  const sinAcentos =
    typeof base.normalize === 'function'
      ? base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : base;
  return ALIAS[sinAcentos] ?? sinAcentos;
}

/** Distritos oficiales de una ciudad, o lista vacía si no está en el catálogo. */
export function distritosDeCatalogo(ciudad: string): readonly string[] {
  return CATALOGO[claveDeCiudad(ciudad)] ?? [];
}

/**
 * Las ciudades del catálogo, con su grafía oficial. Alimentan el buscador de ciudad igual
 * que los distritos el suyo: son las que tienen distritos curados arriba.
 */
export const CIUDADES: readonly string[] = [
  'Barcelona', 'Ciudad de México', 'Madrid', 'Sevilla', 'Valencia', 'Zaragoza',
];

/**
 * Fusión de catálogo + nombres vivos del servidor, sin duplicados y ordenada.
 *
 * El servidor puede traer nombres que no están en el catálogo (pueblos, barrios que la
 * gente creó a mano): se añaden al final, porque una liga con gente dentro vale más que un
 * nombre oficial vacío. El duplicado se detecta por clave normalizada, así «Chamberí» del
 * catálogo absorbe un «chamberi» que alguien creara antes del buscador.
 */
function fusiona(
  oficiales: readonly string[],
  delServidor: readonly string[],
): readonly string[] {
  const vistos = new Set(oficiales.map((d) => claveDeCiudad(d)));

  const extra = delServidor
    .filter((d) => {
      const clave = claveDeCiudad(d);
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));

  return [...oficiales, ...extra];
}

/** Distritos: catálogo de la ciudad + los vivos del servidor. */
export function fusionaDistritos(
  ciudad: string,
  delServidor: readonly string[],
): readonly string[] {
  return fusiona(distritosDeCatalogo(ciudad), delServidor);
}

/** Ciudades: catálogo + las que ya tienen liga viva. */
export function fusionaCiudades(delServidor: readonly string[]): readonly string[] {
  return fusiona(CIUDADES, delServidor);
}

/**
 * Filtro del buscador: las opciones que casan con lo tecleado, por clave normalizada.
 *
 * Las que EMPIEZAN por lo tecleado van primero, las que solo lo contienen después: quien
 * teclea «cha» espera Chamartín y Chamberí arriba, no Fuencarral. Con el campo vacío se
 * devuelve la lista entera, que es el modo "hojear" del desplegable de antes.
 *
 * ⭐ Los alias de ciudad salen gratis: `claveDeCiudad('cdmx')` resuelve a «ciudad de
 * mexico», así que teclear cdmx encuentra Ciudad de México.
 */
export function filtraOpciones(
  texto: string,
  opciones: readonly string[],
): readonly string[] {
  const aguja = claveDeCiudad(texto);
  if (aguja === '') return opciones;

  const empiezan: string[] = [];
  const contienen: string[] = [];
  for (const opcion of opciones) {
    const clave = claveDeCiudad(opcion);
    if (clave.startsWith(aguja)) empiezan.push(opcion);
    else if (clave.includes(aguja)) contienen.push(opcion);
  }
  return [...empiezan, ...contienen];
}

/**
 * Adopta la grafía oficial si lo tecleado coincide con una opción por clave normalizada;
 * si no, devuelve lo tecleado limpio. Es la pieza que hace converger «chamberi» escrito a
 * mano con el «Chamberí» de la lista sin pelearse con quien teclea: se aplica al elegir,
 * al salir del campo y al confirmar, nunca en mitad de la escritura.
 */
export function canonicaliza(texto: string, opciones: readonly string[]): string {
  const limpio = texto.trim();
  if (limpio === '') return '';
  const clave = claveDeCiudad(limpio);
  return opciones.find((o) => claveDeCiudad(o) === clave) ?? limpio;
}

/** Trozos de una opción para resaltar la coincidencia en el buscador. */
export type Coincidencia = { antes: string; medio: string; despues: string };

/**
 * Dónde cae lo tecleado dentro de una opción, en índices del texto ORIGINAL.
 *
 * La comparación va sobre el texto aplanado (minúsculas, sin acentos), pero el resaltado
 * tiene que cortar el original con sus acentos. Como quitar una tilde no cambia el número
 * de caracteres base, se aplana carácter a carácter guardando el índice de origen, y con
 * ese mapa se traducen los cortes. Buscar «montju» en «Sants-Montjuïc» resalta «Montju».
 */
export function parteCoincidente(opcion: string, texto: string): Coincidencia | null {
  const aguja = claveDeCiudad(texto);
  if (aguja === '') return null;

  let plano = '';
  const origen: number[] = [];
  for (let i = 0; i < opcion.length; i++) {
    const c = opcion[i]!.toLowerCase();
    const base =
      typeof c.normalize === 'function'
        ? c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : c;
    if (base.length === 0) continue; // una marca suelta no aporta carácter base
    plano += base[0]!;
    origen.push(i);
  }

  const donde = plano.indexOf(aguja);
  if (donde === -1) return null;

  const inicio = origen[donde]!;
  const fin = (origen[donde + aguja.length - 1] ?? opcion.length - 1) + 1;
  return {
    antes: opcion.slice(0, inicio),
    medio: opcion.slice(inicio, fin),
    despues: opcion.slice(fin),
  };
}
