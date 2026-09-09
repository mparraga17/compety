# Datos de demostración

Para probar la UX real de amigos, ligas y clasificación sin necesitar personas de verdad.

## ⚠️ Antes de nada

**Estos datos no pueden llegar a producción.** Comprueba siempre antes de un build:

```sql
select hay_demo();  -- tiene que dar 0
```

Motivos, en orden de gravedad:

1. Un ranking poblado de gente inventada es engaño al usuario, y Apple es estricta con eso
   (guía 5.1.3.ii prohíbe datos falsos relacionados con salud).
2. Alguien real podría buscar `demo_marta`, agregarla y competir contra un fantasma.
3. Los perfiles demo ocupan nombres de usuario del espacio real.

Las puntuaciones **no** son datos de HealthKit, así que el riesgo es menor que sembrar en
HealthKit directamente. Pero la regla es la misma: fuera antes de publicar.

## Instalar

En el editor SQL del panel de Supabase, en este orden:

1. `migracion-04-demo.sql` — crea las funciones. Una sola vez.
2. `demo-poblar.sql` — crea los seis usuarios y les pone puntuación. Idempotente.

Los dos scripts se pueden reejecutar sin duplicar nada.

## Probar en el iPhone

1. Crea una liga (o entra en una).
2. Ejecuta `demo-poblar.sql`: mete a los demo en **todas** tus ligas.
3. En Amigos, busca `demo_marta`. Aparece con su nombre visible.
4. Agrégala. **Se acepta al instante**, porque un usuario demo no tiene dedo para aceptar.
5. Invítala a tu liga desde la lista de amigos.
6. Vuelve a Competi: ya sale en la clasificación.

Para ver el estado **pendiente**, agrega a `demo_pendiente`: es el único que no acepta.

## ⭐ Las cifras no son al azar

Cada demo representa un caso que el producto **dice** que sabe resolver. Verlos en la tabla es
cómo se comprueba si es verdad.

| Usuario | Puntos | Qué hace | Qué prueba |
|---|---|---|---|
| `demo_marta` | 88 | solo barre | ⭐ **La tesis del producto.** Si Marta no puede ganar haciendo solo barre, el handicap no funciona y no hay producto |
| `demo_sergio` | 80 | solo fuerza | La FC ve la mitad del trabajo isométrico. Sin el factor de modalidad quedaría último |
| `demo_lucia` | 77 | corre mucho | El caso fácil, donde la métrica siempre va bien. Sirve de referencia |
| `demo_carmen` | 61 | golf, 4 h por ronda | Volumen enorme, intensidad baja. Comprueba la compresión del volumen |
| `demo_nacho` | 52 | 7 paseos suaves | ⭐ **El control negativo.** Tiene más sesiones que nadie y queda último |

**Orden esperado: 88 · 80 · 77 · 61 · 52.** Son los mismos números que dio el motor con 58
sesiones reales en Windows, así que la comparación es directa. Si sale otro orden, hay algo que
mirar en el motor.

Y si **Nacho gana**, el ranking volvió a premiar la frecuencia sobre el esfuerzo, que es el fallo
que ya se corrigió tres veces en este proyecto.

## Un bug que salió al escribir esto

`pedir_amistad` devolvía `'enviada'` con el texto fijo, así que al agregar a un demo la app
pintaba **Pendiente** aunque el trigger ya hubiera aceptado la amistad. La prueba de UX habría
mostrado el estado equivocado justo en el paso que se quería probar.

Arreglado con `returning estado into`. El arreglo vale también para personas reales: si algún día
se añade otro trigger sobre `amistades`, la función ya no miente.

## Borrar

```sql
select limpiar_demo();
```

Borra de `auth.users` y el resto cae en cascada: perfiles, miembros, puntuaciones, amistades y
avisos. Es la misma vía que el borrado de cuenta real, así que probar esto prueba también que el
borrado funciona.
