/**
 * Apilado del gráfico de la semana por deporte.
 *
 * ⭐ Petición del usuario (16 sep): *"si hay más de un deporte en cada barra, que esos deportes
 * tengan distintos colores dentro de la paleta"*. Un día con pádel y gym era una columna lisa que
 * sumaba los dos; ahora es una columna con un tramo por deporte.
 *
 * Dos decisiones que viven aquí porque son lógica, no dibujo:
 *
 * 1. **El orden lo decide la semana, no el día.** Los deportes se ordenan por puntos totales de la
 *    semana, y cada día apila los suyos en ESE orden, de abajo arriba. Así el pádel está siempre en
 *    la misma posición y con el mismo tinte en todas las columnas, y la leyenda de debajo del
 *    gráfico se lee una vez para toda la semana. En empate manda el orden de aparición, para que
 *    el gráfico no baile entre dos recargas con los mismos datos.
 *
 * 2. **Una sesión sin puntos no pinta tramo.** Las sesiones sin pulso no puntúan (regla del motor:
 *    no se inventa la carga), así que un tramo de cero alto solo añadiría una separación vacía.
 *
 * Las sesiones sin tipo cuentan como un deporte más ("Actividad" en la interfaz), no se pierden.
 * Los tintes los pone la pantalla: aquí solo hay orden e índices.
 */

export type SesionApilable = { readonly tipo: string | null; readonly puntos: number };

/** Un tramo de la columna de un día: un deporte y lo que sumó ese día. */
export type Tramo = { tipo: string | null; puntos: number };

/** Deportes de la semana ordenados por puntos totales, de más a menos. Empate: orden de aparición. */
export function ordenDeportes(sesiones: readonly SesionApilable[]): (string | null)[] {
  // Un Map conserva el orden de inserción, que es el de aparición: eso resuelve los empates.
  const total = new Map<string | null, number>();
  for (const s of sesiones) total.set(s.tipo, (total.get(s.tipo) ?? 0) + s.puntos);
  return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([tipo]) => tipo);
}

/**
 * Tramos de un día, de abajo arriba, siguiendo el orden de la semana. Solo los deportes con
 * puntos ese día. Un deporte ausente del orden (no debería pasar) va al final, no desaparece.
 */
export function tramosDeDia(
  sesiones: readonly SesionApilable[],
  orden: readonly (string | null)[],
): Tramo[] {
  const porDeporte = new Map<string | null, number>();
  for (const s of sesiones) {
    if (s.puntos <= 0) continue;
    porDeporte.set(s.tipo, (porDeporte.get(s.tipo) ?? 0) + s.puntos);
  }
  const posicion = (tipo: string | null) => {
    const i = orden.indexOf(tipo);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...porDeporte.entries()]
    .sort((a, b) => posicion(a[0]) - posicion(b[0]))
    .map(([tipo, puntos]) => ({ tipo, puntos }));
}
