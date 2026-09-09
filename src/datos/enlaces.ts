/**
 * Enlaces de invitación a una liga.
 *
 * ⭐ El código a secas obligaba a un baile: copiar el código, abrir la app, encontrar "Entrar
 * con código", teclearlo. Con el enlace, quien ya tiene la app aterriza en la pantalla de
 * entrar CON el código puesto, y quien no la tiene cae en una página que se la ofrece. Cada
 * paso que se quita de la invitación es fricción quitada de la acción que hace crecer el
 * producto.
 *
 * Dos formas y por qué dos:
 *
 *   compety://liga/ABC123      el esquema propio. Abre la app directamente, pero solo existe
 *                              si la app está instalada: compartido a pelo sería un enlace
 *                              muerto para el invitado nuevo, que es JUSTO el que importa.
 *   https://…/liga.html?codigo=ABC123
 *                              lo que se comparte SIEMPRE. La página intenta abrir la app por
 *                              el esquema y, si no está, ofrece TestFlight y enseña el código.
 *
 * ⚠️ No son universal links de verdad (abrir la app sin pasar por Safari): eso exige servir
 * `apple-app-site-association` en la RAÍZ del dominio, y en GitHub Pages de proyecto la raíz
 * (mparraga17.github.io) no es de este repo. 📌 Si algún día hay dominio propio, se añade
 * `associatedDomains` y esta página pasa a abrir la app sola.
 *
 * ⚠️ Módulo PURO a propósito (sin expo-linking): el parseo es un par de expresiones regulares
 * y así se prueba en node como el resto de `datos`.
 */

/** Raíz del sitio en GitHub Pages: la invitación y las páginas legales viven ahí. */
const SITIO = 'https://mparraga17.github.io/compety';

/** La página de invitación, servida por GitHub Pages desde `docs/`. */
export const PAGINA_INVITACION = `${SITIO}/liga.html`;

/**
 * Páginas legales, en el idioma de la interfaz.
 *
 * ⭐ Se enlazan DENTRO de la app (alta y Perfil) porque las dos normas lo piden por caminos
 * distintos: Apple exige que una app con cuenta y HealthKit tenga su política accesible desde
 * la propia app, y el RGPD pide transparencia en el momento en que empieza el tratamiento, que
 * es el alta.
 */
export function paginaPrivacidad(idioma: 'es' | 'en'): string {
  return `${SITIO}/privacy-${idioma}.html`;
}

export function paginaTerminos(idioma: 'es' | 'en'): string {
  return `${SITIO}/terms-${idioma}.html`;
}

/** Formato del código de liga: 6 caracteres de letras y números, como los genera el servidor. */
const CODIGO = /^[A-Z0-9]{6}$/;

/** El enlace que se comparte: la página web con el código en la query. */
export function enlaceDeLiga(codigo: string): string {
  return `${PAGINA_INVITACION}?codigo=${encodeURIComponent(codigo.trim().toUpperCase())}`;
}

/**
 * Saca el código de liga de una URL entrante, o null si la URL no es una invitación.
 *
 * ⚠️ Estricto a propósito: el listener de enlaces recibe TODO lo que abre la app, incluidas
 * las URLs del dev client (`exp+compety://expo-development-client/...`). Solo cuentan las dos
 * formas canónicas, y el código tiene que cumplir el formato: un enlace roto devuelve null,
 * nunca un código a medias.
 */
export function codigoDeUrl(url: string): string | null {
  let bruto: string | null = null;

  const esquema = /^compety:\/\/liga\/([^/?#]+)/i.exec(url);
  if (esquema !== null) {
    bruto = esquema[1];
  } else {
    // `\?(?:[^#]*&)?` permite que `codigo` no sea el primer parámetro de la query, y a la vez
    // exige el nombre completo: `micodigo=` no cuela porque delante tiene que haber `?` o `&`.
    const pagina =
      /^https:\/\/mparraga17\.github\.io\/compety\/liga[^?#]*\?(?:[^#]*&)?codigo=([^&#]+)/i.exec(
        url,
      );
    if (pagina !== null) bruto = pagina[1];
  }

  if (bruto === null) return null;
  const codigo = decodeURIComponent(bruto).trim().toUpperCase();
  return CODIGO.test(codigo) ? codigo : null;
}
