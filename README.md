# Compety

[![CI](https://github.com/mparraga17/compety/actions/workflows/ci.yml/badge.svg)](https://github.com/mparraga17/compety/actions/workflows/ci.yml)

App de iOS que mide el esfuerzo de cada sesión de ejercicio y lo convierte en puntos, para competir en ligas privadas con gente que ya conoces.

La idea de fondo: una clase de barre exigente puede sumar más que una carrera tranquila. Ninguna app de competición deportiva puntúa frecuencia cardíaca, así que barre, pilates y fuerza no cuentan en ninguna parte. Compety las cuenta.

## Cómo funciona

```
iPhone                                    Servidor
├─ HealthKit                              ├─ cuentas
│  (pulsera, reloj, apps de deporte)      ├─ ligas
├─ lee pulsos de cada sesión              └─ puntuaciones
├─ calcula zonas de FC
├─ calcula la carga
└─ produce UNA cifra  ────── sube solo esto ──┘
```

**Los datos de salud no salen del teléfono.** El cálculo se hace en local y al servidor solo viaja la puntuación. Tres motivos: es lo que pide el RGPD en cuanto a minimización, una filtración expondría posiciones de un ranking y no historiales médicos, y sale más barato.

## Decisiones de diseño

### La métrica es Edwards TRIMP

Suma los minutos de cada zona de frecuencia cardíaca multiplicados por el número de zona. Está publicado, tiene [validez convergente con Banister TRIMP](https://journals.lww.com/nsca-jscr/Fulltext/2012/01000/The_Convergent_Validity_between_Two_Objective.27.aspx), y es exactamente lo que se puede calcular desde los pulsos que HealthKit expone.

Por qué no la frecuencia cardíaca media: mezcla el esfuerzo con el descanso. En pádel solo el 40 % del partido es juego efectivo, así que promediar dice poco.

### Los pesos por deporte salen de una tabla publicada

Del [Compendium of Physical Activities 2024](https://pubmed.ncbi.nlm.nih.gov/38242596/): 1114 actividades, 912 con el gasto medido por calorimetría indirecta. Correr 9,8 MET, tenis 8,0, pádel 6,8, fuerza 6,0, barre 4,8, golf andando 4,3, caminar 3,8.

Esto sustituyó a factores que estaban puestos a ojo.

### Las horas de más pesan menos

`carga = intensidad × minutos^0.65`. La dosis-respuesta de la actividad física no es lineal: [el beneficio empieza en unos 2.600 pasos y se aplana hacia 8.800](https://www.jacc.org/doi/10.1016/j.jacc.2023.07.029). Con ese exponente, cuatro horas de golf quedan a la altura de noventa minutos de tenis.

### Cada persona se compara consigo misma

Ninguna fórmula de frecuencia cardíaca máxima acierta a nivel individual, y Fitbit se queda hasta 16 lpm por debajo cuando la intensidad es alta. Comparar valores absolutos entre marcas distintas daría una precisión que no existe, así que la puntuación se normaliza contra la propia base histórica de cada uno.

Efecto secundario buscado: eso es el handicap. Si nunca puedes ganar, te vas.

### Sin frecuencia cardíaca también se puntúa

WHOOP solo escribe pulso dentro de entrenos, Garmin recorta valores, y Nike o Strava no tienen sensor. Excluir esas sesiones dejaría fuera a mucha gente.

Tres vías, de más a menos precisa, y cada puntuación declara de dónde viene:

| Origen | Cómo | Descuento |
|---|---|---|
| medida | pulsos reales de la sesión | ninguno |
| declarada | s-RPE, el usuario dice de 1 a 10 | ligero |
| estimada | MET del Compendium y duración | mayor |

El s-RPE no es un parche: tiene validez 0,88 contra TRIMP y está validado en ballet profesional, que es el análogo de barre más cercano publicado.

Cuando la puntuación es estimada la app lo dice, y ofrece mejorarla. Convierte una limitación en un incentivo.

### Lo que no se hace, y por qué

- **No se predicen lesiones.** El ACWR (acute:chronic workload ratio) está desacreditado: [no hay evidencia de que funcione](https://pubmed.ncbi.nlm.nih.gov/32079522/) y hay un paper titulado *Time to Dismiss ACWR*.
- **El HRV no puntúa.** No llega de Fitbit ni de WHOOP, así que puntuarlo premiaría tener una marca concreta.
- **Las fases del sueño no puntúan.** El [consenso de la National Sleep Foundation](https://pubmed.ncbi.nlm.nih.gov/28346153/) no alcanzó acuerdo sobre la arquitectura del sueño, y los wearables fallan justo al repartir fases.
- **Nada de lenguaje médico.** La FDA sancionó a Whoop por una función de bienestar que cruzó a dispositivo médico. La app describe y compara, no diagnostica.

## Datos de varias fuentes

La pulsera, el reloj y las apps de GPS escriben en HealthKit a la vez, así que hay duplicados. Medido con datos reales: de 15 carreras, 11 las registró Nike Run Club y 5 estaban duplicadas solapando al 98 %.

Dos detalles que costaron un bug cada uno:

- La fusión es **N:1 con clusters transitivos**, no comparación por pares. Nike partió una carrera en dos sesiones que la pulsera vio como una.
- La distancia se toma como **máximo**, no de la fuente preferida. Tomarla de Nike daba 2,09 km cuando eran 4,13, porque su registro era de un tramo.

Ninguna fuente se descarta: se fusionan campo a campo. La pulsera aporta corazón, la app de GPS aporta ritmo y distancia.

## Privacidad y permisos

La app pide permiso de HealthKit **después** de una pantalla que explica qué se lee y para qué. No es cortesía: Apple rechaza apps que usan HealthKit sin identificar la funcionalidad en la interfaz.

Y hay un límite de iOS que condiciona el diseño: **una app no puede saber si el usuario concedió permiso de lectura**. Si no lo tiene, la consulta devuelve vacío igual que si no hubiera datos. Así que la app nunca afirma que no hay datos: dice que puede ser falta de pulsera o falta de permiso, y ofrece revisar Ajustes.

Mismo criterio en todo: un hueco no es un cero.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript estricto
- [`@kingstinct/react-native-healthkit`](https://github.com/kingstinct/react-native-healthkit) para leer HealthKit
- Supabase para cuentas, ligas y puntuaciones
- Sin publicidad. Apple prohíbe usar datos de HealthKit con fines publicitarios

Development Build desde el primer commit: HealthKit es un módulo nativo, así que Expo Go no sirve nunca.

## Estructura

```
src/
├─ salud/        lectura de HealthKit
│  ├─ tipos.ts       lista única de lo que se lee
│  ├─ permisos.ts    puerta única de acceso
│  ├─ lectura.ts     consultas
│  └─ estado.ts      cómo se cuenta un dato ausente
├─ motor/        cálculo de la carga
├─ pantallas/
├─ componentes/
└─ i18n/         textos ES y EN
```

Sobre `salud/permisos.ts`: la librería crashea si pides datos de un tipo que no has solicitado en `requestAuthorization`. Se evita por diseño con una lista única de tipos y una puerta que no devuelve nada hasta que la autorización ha resuelto. Si un tipo no está en la lista, no compila.

## Desarrollo

```bash
npm install
npx jest                 # tests del motor, corren sin iPhone
npx tsc --noEmit         # comprobación de tipos
npx expo start --dev-client
```

## Documentos

- [Política de privacidad](https://mparraga17.github.io/compety/privacy-es.html)
- [Términos y condiciones](https://mparraga17.github.io/compety/terms-es.html)

## Licencia

Todos los derechos reservados. El código se publica para que se pueda revisar cómo funciona, en particular el tratamiento de los datos de salud. No se concede licencia de uso, copia, modificación ni redistribución.

---

Pizco Deploy · [pizcodeploy@gmail.com](mailto:pizcodeploy@gmail.com)
