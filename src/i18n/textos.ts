import { getLocales } from 'expo-localization';

/**
 * Textos de la interfaz. Patron de LeonApostolico: deteccion de sistema con override.
 *
 * Reglas de estilo del producto (peticion del usuario):
 * nada de guion largo, flechas ni construcciones tipo "no es X, es Y". Frases cortas
 * y desiguales. El punto medio (·) si vale, Apple lo usa en sus interfaces.
 *
 * ⭐ Y DOS TONOS, decisión del usuario (9 sep): en COMPETI (puesto, jornada, racha,
 * celebraciones) se permite el hype: exclamaciones, verbos de pelea, la corona y el trono.
 * Es la pestaña de jugar, y sonaba a informe. En SALUD y SUEÑO se mantiene la sobriedad:
 * ahí los datos son de salud y el hype sería vender. La ciencia se cita igual en los dos
 * tonos: la frase puede arder, el dato no se toca.
 *
 * Y una regla que costo un bug: un dato nunca lleva texto traducible dentro.
 */

export type Idioma = 'es' | 'en';

const ES = {
  // Arranque: la frase bajo la marca mientras se comprueba la sesión. Juego de palabras con el
  // nombre (Compety ≈ compite), pedido así por el usuario el 16 sep.
  lema: 'Compety con tus amigos',

  // Bienvenida. Apple rechaza apps que usan HealthKit sin explicar la funcion en
  // la interfaz, asi que esta pantalla es requisito, no cortesia.
  bienvenidaTitulo: 'Compite por lo que te cuesta',
  bienvenidaEntrada:
    'Compety mide el esfuerzo de cada sesion y lo convierte en puntos. Una clase de barre exigente puede sumar mas que una carrera tranquila.',
  queLeemos: 'Qué vamos a leer',
  queLeemosSesiones: 'Tus entrenos',
  queLeemosSesionesDetalle: 'Tipo de actividad, duración y hora. De aquí sale qué has hecho.',
  queLeemosFc: 'Tu frecuencia cardiaca durante esos entrenos',
  queLeemosFcDetalle:
    'Es lo que permite comparar deportes distintos. Sin pulso también puntúas, con menos precisión.',
  queLeemosSalud: 'Sueño y métricas diarias',
  queLeemosSaludDetalle: 'Solo para tu propia vista. No entran en ninguna clasificación.',
  dondeVa: 'Dónde va',
  dondeVaDetalle:
    'El cálculo se hace en tu iPhone. Al servidor sube tu puntuación y, de cada entreno, el deporte y la hora; nunca tus pulsos, tu sueño ni la duración.',
  dondeVaCompartido:
    'Los miembros de tu liga ven tu puntuación y tu posición. Tus amigos y tus ligas privadas ven además tus entrenos en el feed: deporte, puntos y si fue una sesión fuerte para ti. Nada más.',
  puedesCambiar: 'Puedes cambiar los permisos cuando quieras desde Ajustes.',
  continuar: 'Continuar',
  masTarde: 'Ahora no',

  // Permisos y datos ausentes. Nunca afirmar que no hay datos.
  sinDatosTitulo: 'No vemos datos',
  sinDatosCuerpo:
    'Puede ser que no llevaras la pulsera, o que falte el permiso. No podemos distinguirlo: iOS no nos lo cuenta, por privacidad.',
  sinDatosFc:
    'No vemos frecuencia cardiaca en esta sesión. Puede ser que no llevaras la pulsera, o que falte el permiso.',
  revisarPermisos: 'Revisar permisos',
  sinHealthKit: 'Este dispositivo no tiene datos de salud disponibles.',

  // Sesiones estimadas sin FC
  cargaEstimada: 'Puntuación estimada',
  cargaEstimadaCuerpo:
    'Sin frecuencia cardiaca hemos estimado esta sesión por el tipo de actividad y la duración. Si llevas pulsera o nos dices cómo de dura fue, la puntuación se ajusta a lo que hiciste de verdad.',
  comoDeDura: '¿Cómo de dura fue?',
  suave: 'Suave',
  muyDura: 'Muy dura',
  guardarEsfuerzo: 'Guardar',
  origenMedida: 'medida',
  origenDeclarada: 'según tú',
  origenEstimada: 'estimada',

  // ── Entrada ──────────────────────────────────────────────────────────────
  entradaLema:
    'Compite con tus amigos con lo que ya mide tu pulsera. Tus datos de salud se quedan en tu iPhone.',
  sinApple:
    'Este dispositivo no admite Sign in with Apple. Compety necesita un iPhone con iOS 13 o posterior.',
  comoTeLlamamos: '¿Cómo te llamamos?',
  nombreVisibleTexto: 'Es lo que van a ver los demás en la clasificación, junto con tu puntuación.',
  tuNombre: 'Tu nombre',
  seguir: 'Seguir',
  eligeUsuario: 'Elige tu nombre de usuario',
  usuarioTexto:
    'Es con lo que te encuentran tus amigos para agregarte. Solo verán tu nombre, nunca tus datos, hasta que estéis en la misma liga.',
  formatoUsuario: 'Entre 3 y 20 caracteres: letras, números y guion bajo.',
  listo: 'Listo',
  // Aviso legal del alta, en fragmentos porque los dos enlaces van dentro de la frase.
  legalAntes: 'Al continuar aceptas los ',
  legalTerminos: 'términos',
  legalEntre: ' y la ',
  legalPrivacidad: 'política de privacidad',
  verPrivacidad: 'Política de privacidad',
  verTerminos: 'Términos y condiciones',

  // ── Pestañas ─────────────────────────────────────────────────────────────
  tabHoy: 'Hoy',
  tabSesiones: 'Sesiones',
  tabSueno: 'Sueño',
  tabSalud: 'Salud',

  // ── Hoy ──────────────────────────────────────────────────────────────────
  hoyTitulo: 'Esta semana',
  hoyResumen: 'tus %{n} mejores de %{s} sesiones, %{m} min',
  puntosEsfuerzo: 'puntos de esfuerzo',
  // Banda del gráfico de la semana: lo que vale una sesión normal para ti, en puntos.
  sesionHabitual: 'sesión habitual · %{min}–%{max}',
  // Etiqueta accesible del avatar de la cabecera, que abre el perfil.
  abrirPerfil: 'Tu perfil',
  ultimos30Dias: 'últimos 30 días',
  saludContexto: 'esta semana · objetivo OMS',
  anoche: 'anoche',
  // Banda del gráfico de noches: media ± una desviación de las noches que se ven.
  suenoBanda: 'tu normal · %{min}–%{max}',
  puesto: 'Puesto',
  alLider: 'Al líder',
  deportes: 'Deportes',
  ultimasSesiones: 'Últimas sesiones',
  diaResumen: '%{n} sesiones',
  diaResumenUna: 'Una sesión',
  total: 'Total',
  sinSesiones: 'Todavía no hay sesiones en esta ventana.',
  sinSesionesTexto:
    'Cuando entrenes con la pulsera puesta, la sesión aparece aquí con su puntuación.',
  minutos: 'Minutos',
  dentroDeRango: 'dentro de tu rango habitual',
  porEncima: 'por encima de tu rango habitual',
  porDebajo: 'por debajo de tu rango habitual',
  tuRango: 'tu normal va de %{min} a %{max} de carga',
  // Frase completa, para que la mayúscula y el punto queden donde toca en cada idioma.
  fraseHoy: 'Tu %{deporte} está %{donde}. Tu normal va de %{min} a %{max} de carga.',

  // ── Sesiones ─────────────────────────────────────────────────────────────
  sesionesTitulo: 'Sesiones',
  sesionesResumen: '%{n} últimas, %{f} fusionadas, %{s} sin pulso',
  /**
   * ⭐ Cabecera nueva de Sesiones, con cifra protagonista.
   *
   * La pantalla era la única sin cifra grande, así que el título de 15px tenue (que está pensado
   * para ir ENCIMA de una cifra) se quedaba solo y la parte de arriba parecía diminuta. Ahora la
   * protagonista es cuántas sesiones hay en el historial y la frase la sitúa.
   */
  sesionesEnTotal: 'sesiones registradas',
  /** Frase de contexto. Se compone con los días de historial y las que puntúan esta semana. */
  sesionesFrase: 'En %{dias} días. %{cuentan} cuentan para la semana en curso.',
  sesionesFraseUna: 'En %{dias} días. Una cuenta para la semana en curso.',
  sesionesFraseNinguna: 'En %{dias} días. Ninguna cuenta todavía esta semana.',
  /** Etiquetas de la fila de datos, en el mismo formato que Hoy. */
  sesionesConPulso: 'Con pulso',
  sesionesFusionadas: 'Fusionadas',
  esteMes: 'Este mes',
  puntos: 'puntos',
  cabeceraPuntos: 'Puntos',
  noPuntua: 'no puntúa',
  sinPulsoEtiqueta: 'sin pulso',
  tagFusionada: 'FUSIONADA',
  tagSinPulso: 'SIN PULSO',
  // Entreno tecleado en la app Salud. Puntúa por estimación o esfuerzo declarado, nunca por pulso.
  tagManual: 'A MANO',
  // Marca las sesiones que entran en el top de la semana. Sin esto el ranking parece arbitrario:
  // ves siete cifras y un total que no es su suma.
  tagCuenta: 'CUENTA',

  // ── Detalle de sesión ────────────────────────────────────────────────────
  porQueEstosPuntos: 'Por qué estos puntos',
  deporteDeSesion: 'Deporte',
  deporteDeSesionTexto:
    'Si la pulsera guardó mal el deporte, elígelo aquí. La sesión vuelve a puntuar con los pesos del deporte real y compite en su liga.',
  carga: 'Carga',
  compiteEn: 'Compite en',
  compiteEnTexto:
    'Todos los deportes entran en la clasificación general. El equilibrio lo dan el peso de cada deporte y que las horas de más pesen menos, así que no hace falta dejar a nadie fuera.',
  fusionadaCon: 'Esta sesión la registraron varias fuentes y se han unido: %{fuentes}.',
  // Pasos del desglose. El motor da las cifras, la frase se arma aquí.
  pasoIntensidadMedida: 'intensidad medida por tu pulso, %{intensidad} por minuto',
  pasoIntensidadDeclarada:
    'esfuerzo declarado %{esfuerzo} de 10, equivale a %{intensidad} de intensidad',
  pasoIntensidadTipica: 'intensidad habitual en este deporte, %{intensidad} por minuto',
  pasoIntensidadParecida:
    'intensidad habitual en actividades parecidas, %{intensidad} por minuto',
  pasoFactorModalidad:
    'x%{factor} porque en este deporte el pulso suele marcar %{metObservado} MET y la tabla da %{metOficial}',
  pasoVolumen: '%{minutos} min comprimidos a %{volumen}',
  pasoDescuentoSinPulso: 'descuento por no medir el pulso, x%{descuento}',
  pasoContraTuBase: 'tu media es %{media}, esta sesión %{carga}, o sea %{signo}%{z}σ',
  pasoSinHistorial: 'todavía no hay historial para comparar, así que se queda en tu media',

  // ── Sueño ────────────────────────────────────────────────────────────────
  // La cifra NO es "cuánto duermes": regularidad 45, eficiencia 30 y duración 25. Los textos
  // hablan de horarios por eso, porque es lo que más pesa.
  suenoTitulo: 'Sueño',
  suenoSubtitulo: '%{n} noches analizadas',
  suenoDeCien: 'puntos sobre 100',
  suenoFrase:
    'Te acuestas sobre las %{hora} con %{variacion} min de variación. %{cortas} de %{total} noches se quedan cortas.',
  suenoPocasNoches: 'Hacen falta al menos %{n} noches para medir tus horarios.',
  suenoSinDatos: 'Todavía no hay noches registradas.',
  suenoSinDatosTexto:
    'Duerme con la pulsera puesta y aquí aparecerá tu puntuación, con tus horarios y tus noches cortas.',
  suenoLeyendaNoches: 'Últimas noches, con la línea de las 7 h. %{n} siestas en gris.',
  // Las frases del desglose se arman en la pantalla con las cifras del motor. El motor no las
  // devuelve hechas, porque entonces no podrían cambiar de idioma.
  suenoFormulaRegularidad:
    'te acuestas sobre las %{acostarse} con %{variacionAcostarse} min de variación, y te levantas sobre las %{levantarse} con %{variacionLevantarse} min',
  suenoFormulaEficiencia:
    'duermes el %{porcentaje} % del tiempo que pasas en la cama, con %{despierto} min despierto por noche',
  suenoFormulaDuracion:
    '%{cumplidas} de %{total} noches llegan a %{objetivo} h, con una media de %{media} h',
  suenoSinTiempoEnCama: 'tu pulsera no está escribiendo el tiempo que pasas en la cama',
  // ⚠️ Planas y no anidadas: `Textos` es `Record<clave, string>`, así que un objeto dentro
  // rompe el tipo en las dos pantallas que lo consumen.
  suenoRegularidad: 'Regularidad',
  suenoDuracion: 'Duración',
  suenoMedia: 'Media',
  suenoEficiencia: 'Eficiencia',
  suenoSiestas: 'Siestas',
  suenoFases: 'Fases',
  suenoFasesNoPuntuan:
    'Se muestran como información. No puntúan, porque el consenso científico no las respalda como indicador de calidad.',
  suenoProfundo: 'Profundo',
  suenoRem: 'REM',
  suenoAproximado:
    'La regularidad es una aproximación con las horas de acostarse y levantarse. El índice validado necesita medición minuto a minuto.',

  // ── Salud ────────────────────────────────────────────────────────────────
  // El protagonista es el objetivo de la OMS, no una métrica de la pulsera: es el único objetivo
  // del producto que no nos hemos inventado.
  saludTitulo: 'Salud',
  saludSubtitulo: 'Tu objetivo semanal y lo que mide la pulsera. Nada de esto puntúa.',
  minEquivalentes: 'min moderados equivalentes',
  omsCumplido: 'Has cumplido el objetivo semanal de la OMS.',
  omsFaltan: 'Te faltan %{n} min para el objetivo semanal de la OMS.',

  // ── Celebración ───────────────────────────────────────────────────────────
  // Momentos pico. Cada uno se celebra UNA vez por periodo, nunca en bucle. Tono Competi:
  // si algún texto de la app puede arder, es este. La ciencia se cita igual.
  celebraOmsTitulo: '¡Objetivo de la OMS cumplido!',
  celebraOmsFrase:
    '¡Has clavado los %{n} min moderados equivalentes de la semana! Es el objetivo con más evidencia detrás.',
  celebraPrimeroTitulo: '¡Vas primero en %{liga}!',
  celebraPrimeroFrase: 'Encabezas la tabla con %{p} puntos. Ahora toca defender la corona.',

  // ── Racha de semanas ──────────────────────────────────────────────────────
  // ⭐ Cada mensaje cita un dato REAL con su fuente en la ficha de ciencia. Las cifras están
  // verificadas: 25 % viene de Eur J Epidemiol 2015; el "empezar ya cuenta" de EPIC-Norfolk
  // (BMJ 2019, HR 0,76); el 26-31 % de Circulation 2022 con 2-4 veces el objetivo.
  rachaTitulo: 'Tu racha',
  rachaSemanas: '¡%{n} semanas seguidas cumpliendo el objetivo!',
  rachaUnaSemana: 'Una semana en el objetivo. La racha ha empezado.',
  rachaCero: 'Tu racha arranca esta semana',
  rachaSemanaActual: 'Esta semana ya está asegurada. Nadie te la quita.',
  rachaVerCiencia: 'Ver la ciencia',
  rachaArranca:
    'Enciende la racha esta semana. Empezar ya paga: pasar de inactivo a cumplir el objetivo se asocia con un 24 % menos de mortalidad.',
  rachaPrimera:
    '¡Primera semana cumplida! Mantener el objetivo de la OMS se asocia con ~25 % menos mortalidad por cualquier causa.',
  rachaCorta:
    'La racha crece. Semana tras semana en el objetivo se asocia con ~25 % menos mortalidad, y cada una que añades sostiene el efecto.',
  rachaLarga:
    '¡Racha seria! Estás en la zona de mayor beneficio: entre 2 y 4 veces el objetivo, los estudios ven un 26-31 % menos de mortalidad.',
  rachaReparada:
    'Comodín usado y racha salvada. Una semana floja no borra lo acumulado: lo que cuenta es el patrón.',
  /** El comodín, explicado. Se regenera tras 4 semanas cumplidas. */
  rachaComodin: 'Tienes un comodín: una semana floja no rompe la racha.',
  rachaSinComodin: 'Comodín gastado. Cuatro semanas cumplidas y vuelve al bolsillo.',

  // ── Cierres y palmarés ────────────────────────────────────────────────────
  cierreSemana: 'Resultado de la semana',
  cierreMes: 'Resultado del mes',
  cierreAnio: 'Resultado del año',
  cierreGano: 'Ganó %{quien}',
  cierreGanaste: '¡Ganaste tú!',
  cierreTuPuesto: 'Quedaste %{puesto} con %{p} puntos',
  palmares: 'Palmarés',
  semanasGanadas: '%{n} semanas ganadas',
  unaSemanaGanada: 'Una semana ganada',
  temporada: 'Temporada %{anio}',
  moderada: 'Moderada',
  vigorosa: 'Vigorosa',
  diasFuerza: 'Días de fuerza',

  formaTitulo: 'Forma',
  formaMejora: 'Haces el mismo esfuerzo con un %{pct} % menos de pulso que antes.',
  formaPeor: 'El mismo esfuerzo te cuesta un %{pct} % más de pulso que antes.',
  formaIgual: 'Tu coste cardíaco está prácticamente igual que antes.',
  formaDetalle: 'En %{liga} has pasado de %{antes} a %{ahora} %{unidad} de media.',
  formaPocoFiable:
    'Con solo %{n} sesiones comparables la señal es débil. Hará falta más historial.',
  formaPocasSesiones:
    'Hacen falta al menos %{minimo} sesiones con ritmo y pulso para medir tu forma. Llevas %{n}.',

  tuCuerpo: 'Tu cuerpo',
  tuCuerpoSub: 'Cada dato se compara con tu rango habitual de los últimos 90 días.',
  metricaHrv: 'Variabilidad cardíaca',
  metricaFcReposo: 'Pulso en reposo',
  metricaSpo2: 'Oxígeno en sangre',
  metricaRespiracion: 'Respiración',
  metricaVo2max: 'VO₂ máx',
  metricaPasos: 'Pasos',
  lpm: 'lpm',
  rpm: 'rpm',
  sinDatosMetrica: 'sin datos',
  estadoDentro: 'dentro de tu rango habitual',
  estadoMejor: 'mejor de lo habitual',
  estadoPeor: 'peor de lo habitual',
  estadoSinBanda: 'todavía sin rango de referencia',
  rangoHabitual: 'tu normal va de %{min} a %{max}',
  estable: 'estable',
  subiendo: 'subiendo %{n}',
  bajando: 'bajando %{n}',
  avisoModelo: 'Este valor lo calcula un modelo, no lo mide el sensor. Mira la tendencia.',
  coberturaAviso:
    'Un día sin dato significa que no llevabas la pulsera, no un cero. Y si una métrica no aparece, puede ser que tu pulsera no la escriba en Salud.',

  tuBase: 'Tu base',
  baseCalculada: 'Calculada con tus %{n} últimas sesiones.',
  cargaMedia: 'Carga media',
  tuRangoCarga: 'Tu rango',
  basePocoFiable: 'Con menos de 10 sesiones esta base se mueve bastante al llegar datos nuevos.',

  // ── Ciencia ──────────────────────────────────────────────────────────────
  // Botón al final de cada pestaña que recoge sus fuentes. Va agrupado y no repartido por la
  // vista, porque las fichas sueltas llenaban de texto pantallas que deben leerse de un vistazo.
  enQueNosBasamos: 'En qué nos basamos',
  cienciaSubtitulo: '%{n} decisiones y su fuente',
  basadoEn: 'Basado en',
  cerrar: 'Cerrar',

  // Enlace al diagnóstico, que dice qué métricas llegan de verdad de la pulsera a Salud.
  verDiagnostico: 'Ver el diagnóstico de datos',

  // ── Competición ──────────────────────────────────────────────────────────
  competi: 'Competi',
  // Frases del puesto. Cuatro casos, y el de "primero solo" hace falta: sin él la frase queda
  // hablando de un segundo que no existe. Tono Competi: aquí se pelea.
  vasPrimero: 'Vas primero con %{p} puntos. Aguanta, que %{quien} viene a por ti.',
  vasPrimeroSolo: 'Líder en solitario con %{p} puntos. Trae rivales y defiende el trono.',
  teFaltan: 'A %{p} puntos de cazar a %{quien}. Una sesión buena y adelantas.',
  noParticipas: 'Esta semana aún no has puntuado aquí. La primera sesión te mete en la pelea.',
  agregarAmigos: 'Agregar amigos',
  tuPerfil: 'Tu perfil',
  sinServidor: 'Sin servidor',
  liga: 'Liga',
  periodo: 'Periodo',
  // Estado vacío de la liga. Invitar es la acción de la que depende que el producto exista, así
  // que cuando estás solo se pone delante y no escondida en un icono.
  unMiembro: '1 miembro',
  nMiembros: '%{n} miembros',
  ligaVaciaTitulo: 'Todavía compites solo',
  ligaVaciaTexto:
    'Pasa el código %{codigo} por WhatsApp y llena esto de rivales, o busca a alguien por su nombre de usuario.',
  // ⭐ Tu progreso contra ti mismo, junto al puesto. Va aquí porque un puesto sin contexto propio
  // desanima a quien no va primero, y eso está medido en la literatura de leaderboards.
  progresoMejor: 'Tu último %{deporte} fue más duro de lo habitual para ti. Tu normal va de %{min} a %{max} de carga.',
  progresoIgual: 'Tu último %{deporte} está dentro de tu rango habitual, de %{min} a %{max} de carga.',
  progresoPeor: 'Tu último %{deporte} fue más suave de lo habitual para ti. Tu normal va de %{min} a %{max} de carga.',
  sinServidorTexto:
    'No llegan las claves de Supabase. Si estás en desarrollo, casi siempre es que Metro arrancó sin recargar el .env.',
  // Arranque con sesión guardada pero sin poder comprobarla. Se dice que la cuenta está, para
  // que nadie crea que la ha perdido, y se ofrece reintentar.
  sinConexionTitulo: 'Sin conexión',
  sinConexionTexto:
    'Tu cuenta sigue aquí, pero ahora mismo no llegamos al servidor. Comprueba la red y vuelve a intentarlo.',
  reintentar: 'Reintentar',
  sinLiga: 'Tu primera liga está a un toque',
  sinLigaTexto:
    'Crea la tuya y reparte el código, o entra con el que te hayan pasado. En dos minutos estás compitiendo.',
  crearLiga: 'Crear una liga',
  tengoCodigo: 'Tengo un código',
  crearOtra: 'Crear otra liga',
  entrarConCodigo: 'Entrar con código',
  nadiePuntua:
    'Nadie ha puntuado en esta ventana todavía. Estrena tú el marcador: las puntuaciones suben cuando cada persona abre la app.',
  deN: 'de',
  conPuntos: 'con %{p} puntos',
  unaSesion: '1 sesión',
  nSesiones: '%{n} sesiones',
  semanaFuerte: 'semana fuerte',
  codigoDe: 'Código de %{liga}: %{codigo}',
  /** La acción corta de la fila del código. La larga es `compartirCodigo`. */
  compartirLiga: 'Compartir',

  // ── Nueva liga ───────────────────────────────────────────────────────────
  crearTitulo: 'Crear una liga',
  crearTexto: 'Ponle nombre y elige si compite en todo o en un deporte concreto.',
  nombreLigaEjemplo: 'Los del jueves',
  deporte: 'Deporte',
  generalTexto:
    'En la general puntúa cualquier actividad. Una clase de barre puede sumar más que una carrera tranquila.',
  crear: 'Crear',
  cancelar: 'Cancelar',
  ligaCreada: 'Liga creada',
  ligaCreadaTexto:
    'Comparte la invitación: el enlace lleva el código puesto. Sin código no se puede ver la liga.',
  compartirCodigo: 'Compartir invitación',
  // El mensaje que viaja por WhatsApp: enlace que abre la app (o la página que la ofrece) y
  // el código escrito, por si el mensajero rompe la URL. Tono Competi: es un reto, no un aviso.
  invitacion:
    'Te reto en «%{liga}», mi liga de Compety. Toca el enlace o entra con el código %{codigo}: %{enlace}',
  verClasificacion: 'Ver la clasificación',
  entrarTitulo: 'Entrar en una liga',
  entrarTexto: 'Escribe el código de seis caracteres que te han pasado.',
  entrar: 'Entrar',

  // ── Amigos ───────────────────────────────────────────────────────────────
  amigos: 'Amigos',
  buscarPlaceholder: 'nombre exacto',
  buscar: 'Buscar',
  buscarPista:
    'Hace falta el nombre de usuario completo. No hay sugerencias: así nadie puede ir viendo quién usa la app.',
  noHallado: 'No hay nadie con ese nombre de usuario.',
  agregar: 'Agregar',
  aceptar: 'Aceptar',
  no: 'No',
  retirar: 'Retirar',
  invitar: 'Invitar',
  pendiente: 'Pendiente',
  yaAmigos: 'Amigos',
  eresTu: 'Eres tú',
  peticionEnviada: 'Petición enviada.',
  yaSoisAmigos: 'Ya sois amigos.',
  teHanAgregado: 'Te han agregado',
  tusAmigos: 'Tus amigos',
  sinAmigos: 'Todavía no tienes amigos aquí',
  sinAmigosTexto:
    'Busca a alguien por su nombre de usuario, o pásale el código de tu liga por WhatsApp, que para un grupo entero es más rápido.',
  esperandoRespuesta: 'Esperando respuesta',
  invitarA: 'Invitar a:',
  entraEn: '%{quien} entra en %{liga}.',

  // ── Ligas de zona ────────────────────────────────────────────────────────
  // Públicas por ciudad y distrito, con divisiones al estilo Duolingo: cohortes pequeñas,
  // jornada semanal, los de arriba suben y los de abajo bajan.
  tuZona: 'Tu zona',
  zonaTitulo: 'Compite en tu zona',
  zonaTexto:
    'Entra en la liga pública de tu ciudad, y de tu barrio si quieres. Cada semana los primeros suben de división y los últimos bajan.',
  zonaPrivacidad:
    'Tu ubicación solo se usa aquí, para sugerirte la zona. No se guarda ni sale de tu iPhone: al servidor viaja solo el nombre que confirmes.',
  usarUbicacion: 'Usar mi ubicación',
  ubicacionBuscando: 'Buscando tu zona…',
  ubicacionDenegada:
    'Sin permiso de ubicación. Puedes darlo en Ajustes, o escribir tu zona aquí abajo.',
  ubicacionSinResultado: 'No hemos podido detectar tu zona. Escríbela aquí abajo.',
  ciudad: 'Ciudad',
  ciudadEjemplo: 'Madrid',
  distrito: 'Distrito o barrio',
  distritoOpcional: 'Opcional. Con distrito compites en dos tablas: la del barrio y la de la ciudad.',
  distritoEjemplo: 'Chamberí',
  usarTexto: 'Usar «%{texto}»',
  unirmeAZona: 'Entrar en mi zona',
  zonaLista: 'Ya estás dentro',
  zonaListaTexto: 'Compites en %{zonas}. La jornada se cierra cada lunes.',
  cambiarZona: 'Cambiar de zona',
  salirDeZona: 'Salir de las ligas de zona',
  salirDeZonaAviso: 'Sales de las ligas públicas de tu zona. Tus ligas privadas no se tocan.',
  division: 'División %{n}',
  divisionCorta: 'Div. %{n}',
  zonaSube: 'Sube',
  zonaBaja: 'Baja',
  zonaJornada: 'El lunes se juega todo: suben los %{s} primeros y bajan los %{b} últimos.',
  zonaJornadaSoloSube: 'El lunes suben los %{s} primeros. Pelea tu plaza.',
  zonaJornadaSoloBaja: 'El lunes bajan los %{b} últimos. Que no te pille abajo.',
  zonaJornadaUnoSube: 'El primero sube el lunes. Puedes ser tú.',
  zonaJornadaUnoBaja: 'El último baja el lunes. Sal de ahí.',
  zonaPocos: 'Con menos de 4 personas la jornada no arranca. Trae a tu gente y que empiece la pelea.',
  // Celebración del ascenso y noticia del descenso. El ascenso es momento pico; el descenso
  // se cuenta sin castigo, con la vía de vuelta delante.
  celebraAscensoTitulo: '¡Ascenso en %{zona}!',
  celebraAscensoFrase: '¡Semana enorme! Terminaste entre los primeros y ya compites en la División %{n}.',
  noticiaDescenso: 'Bajas a la División %{n} en %{zona}. Nada que no arregle una buena semana: la remontada empieza hoy.',

  // ── Perfil ───────────────────────────────────────────────────────────────
  nombreVisible: 'Nombre visible',
  nombreVisibleCorto: 'Lo que ven los demás en la clasificación.',
  nombreUsuario: 'Nombre de usuario',
  guardarNombre: 'Guardar nombre',
  guardarUsuario: 'Guardar nombre de usuario',
  nombreGuardado: 'Nombre guardado.',
  usuarioGuardado: 'Nombre de usuario guardado.',
  /** Sección de ajustes del perfil, donde ahora vive el idioma. */
  ajustes: 'Ajustes',
  idioma: 'Idioma',
  idiomaPista: 'Se aplica al momento, sin reiniciar la app.',
  cuenta: 'Cuenta',
  cuentaTexto:
    'Tus datos de salud se quedan en el iPhone. Al servidor sube tu puntuación y, de cada entreno, el deporte y la hora.',
  cerrarSesion: 'Cerrar sesión',
  borrarCuenta: 'Borrar la cuenta',
  borrarAviso:
    'Se borran tu cuenta, tu nombre, tus puntuaciones, tus amigos y tu sitio en las ligas. No se puede deshacer.',
  borrar: 'Borrar',
  volverA: '‹ %{donde}',
  atras: 'Atrás',

  // ── Feed de amigos (segunda página de Competi) ────────────────────────────
  paraTi: 'Para ti',
  feedAmigos: 'Amigos',
  feedVacio: 'Aquí saldrán los entrenos de tu gente',
  feedVacioTexto:
    'Los de tus amigos y los de quienes compiten contigo en una liga privada. Cada entreno se puede aplaudir y comentar.',
  feedSinGente: 'Todavía no sigues a nadie: agrega amigos o invita a alguien a tu liga.',
  feedPrivacidad: 'Tus entrenos los ven tus amigos y tus ligas privadas. Nunca las ligas de zona.',
  feedTuEntreno: 'Tú',
  feedSesionFuerte: 'sesión fuerte',
  feedSesionNormal: 'sesión normal',
  feedSesionSuave: 'sesión suave',
  feedAhora: 'ahora',
  feedHaceMin: 'hace %{n} min',
  feedHaceHoras: 'hace %{n} h',
  feedAyer: 'ayer',
  feedHaceDias: 'hace %{n} días',
  feedComentarios: 'Comentarios',
  feedUnComentario: '1 comentario',
  feedNComentarios: '%{n} comentarios',
  feedComentar: 'Comentar',
  feedEscribe: 'Escribe algo…',
  feedEnviar: 'Enviar',
  feedSinComentarios: 'Nadie ha comentado todavía. Sé el primero.',
  feedReaccionaron: 'Han reaccionado',
  feedReaccionar: 'Reaccionar',
  feedQuitar: 'Quitar del feed',
  feedQuitarAviso: 'Este entreno desaparece del feed de todo el mundo, con sus reacciones y comentarios.',
  feedCargarMas: 'Cargar más',
  feedError: 'No se ha podido cargar el feed. Desliza hacia abajo para reintentar.',

  // ── Ficha de una persona (sus entrenos) ──────────────────────────────────
  personaEntrenos: 'Sus entrenos',
  personaSinEntrenos: 'Todavía no ha publicado ningún entreno. Aparecerán aquí cuando abra la app.',
  personaOculta:
    'Solo tus amigos y quienes compiten contigo en una liga privada te enseñan sus entrenos. Compartís una liga de zona, así que aún no puedes verlos.',
  personaPedir: 'Pedir amistad',
  personaPedida: 'Petición enviada. Cuando acepte, verás sus entrenos aquí.',
  personaTusEntrenos: 'Tus entrenos, tal y como los ve tu gente.',
} as const;

const EN: Record<keyof typeof ES, string> = {
  lema: 'Compety with your friends',
  bienvenidaTitulo: 'Compete on what it costs you',
  bienvenidaEntrada:
    'Compety measures the effort of each session and turns it into points. A hard barre class can score more than an easy run.',
  queLeemos: 'What we read',
  queLeemosSesiones: 'Your workouts',
  queLeemosSesionesDetalle: 'Activity type, duration and time. This is what you did.',
  queLeemosFc: 'Your heart rate during those workouts',
  queLeemosFcDetalle:
    'This is what makes different sports comparable. Without heart rate you still score, with less precision.',
  queLeemosSalud: 'Sleep and daily metrics',
  queLeemosSaludDetalle: 'For your own view only. They never enter a ranking.',
  dondeVa: 'Where it goes',
  dondeVaDetalle:
    'The calculation happens on your iPhone. Your score goes to the server and, for each workout, the sport and the time; never your heart rate, your sleep or the duration.',
  dondeVaCompartido:
    'League members see your score and your position. Your friends and private leagues also see your workouts in the feed: sport, points and whether it was a hard session for you. Nothing else.',
  puedesCambiar: 'You can change permissions any time in Settings.',
  continuar: 'Continue',
  masTarde: 'Not now',

  sinDatosTitulo: 'We see no data',
  sinDatosCuerpo:
    'You may not have been wearing your tracker, or the permission may be missing. We cannot tell which: iOS does not tell us, for privacy.',
  sinDatosFc:
    'We see no heart rate for this session. You may not have been wearing your tracker, or the permission may be missing.',
  revisarPermisos: 'Review permissions',
  sinHealthKit: 'This device has no health data available.',

  cargaEstimada: 'Estimated score',
  cargaEstimadaCuerpo:
    'Without heart rate we estimated this session from the activity type and duration. Wear a tracker, or tell us how hard it felt, and the score matches what you actually did.',
  comoDeDura: 'How hard was it?',
  suave: 'Easy',
  muyDura: 'Very hard',
  guardarEsfuerzo: 'Save',
  origenMedida: 'measured',
  origenDeclarada: 'your call',
  origenEstimada: 'estimated',

  // ── Sign in ──────────────────────────────────────────────────────────────
  entradaLema:
    'Compete with your friends using what your tracker already measures. Your health data stays on your iPhone.',
  sinApple:
    'This device does not support Sign in with Apple. Compety needs an iPhone running iOS 13 or later.',
  comoTeLlamamos: 'What should we call you?',
  nombreVisibleTexto: "It's what others see in the ranking, next to your score.",
  tuNombre: 'Your name',
  seguir: 'Next',
  eligeUsuario: 'Pick your username',
  usuarioTexto:
    "It's how your friends find you. They only see your name, never your data, until you're in the same league.",
  formatoUsuario: '3 to 20 characters: letters, numbers and underscore.',
  listo: 'Done',
  legalAntes: 'By continuing you accept the ',
  legalTerminos: 'terms',
  legalEntre: ' and the ',
  legalPrivacidad: 'privacy policy',
  verPrivacidad: 'Privacy policy',
  verTerminos: 'Terms and conditions',

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabHoy: 'Today',
  tabSesiones: 'Sessions',
  tabSueno: 'Sleep',
  tabSalud: 'Health',

  // ── Today ────────────────────────────────────────────────────────────────
  hoyTitulo: 'This week',
  hoyResumen: 'your top %{n} of %{s} sessions, %{m} min',
  puntosEsfuerzo: 'effort points',
  sesionHabitual: 'usual session · %{min}–%{max}',
  abrirPerfil: 'Your profile',
  ultimos30Dias: 'last 30 days',
  saludContexto: 'this week · WHO target',
  anoche: 'last night',
  suenoBanda: 'your normal · %{min}–%{max}',
  puesto: 'Rank',
  alLider: 'To leader',
  deportes: 'Sports',
  ultimasSesiones: 'Latest sessions',
  diaResumen: '%{n} sessions',
  diaResumenUna: 'One session',
  total: 'Total',
  sinSesiones: 'No sessions in this window yet.',
  sinSesionesTexto:
    'Train with your tracker on and the session shows up here with its score.',
  minutos: 'Minutes',
  dentroDeRango: 'within your usual range',
  porEncima: 'above your usual range',
  porDebajo: 'below your usual range',
  tuRango: 'your normal runs from %{min} to %{max} of load',
  fraseHoy: 'Your %{deporte} was %{donde}. Your normal runs from %{min} to %{max} of load.',

  // ── Sessions ─────────────────────────────────────────────────────────────
  sesionesTitulo: 'Sessions',
  sesionesResumen: 'last %{n}, %{f} merged, %{s} without heart rate',
  sesionesEnTotal: 'sessions recorded',
  sesionesFrase: 'Over %{dias} days. %{cuentan} count towards the current week.',
  sesionesFraseUna: 'Over %{dias} days. One counts towards the current week.',
  sesionesFraseNinguna: 'Over %{dias} days. None count towards this week yet.',
  sesionesConPulso: 'With heart rate',
  sesionesFusionadas: 'Merged',
  esteMes: 'This month',
  puntos: 'points',
  cabeceraPuntos: 'Points',
  noPuntua: 'no score',
  sinPulsoEtiqueta: 'no heart rate',
  tagFusionada: 'MERGED',
  tagSinPulso: 'NO HR',
  tagManual: 'MANUAL',
  tagCuenta: 'COUNTS',

  // ── Detalle de sesión ────────────────────────────────────────────────────
  porQueEstosPuntos: 'Why these points',
  deporteDeSesion: 'Sport',
  deporteDeSesionTexto:
    'If your tracker saved the wrong sport, pick it here. The session is scored again with the real sport and competes in its league.',
  carga: 'Load',
  compiteEn: 'Competes in',
  compiteEnTexto:
    'Every sport counts towards the general standings. The balance comes from each sport weight and from extra hours weighing less, so nobody has to be left out.',
  fusionadaCon: 'Several sources recorded this session and they have been merged: %{fuentes}.',
  pasoIntensidadMedida: 'intensity measured from your heart rate, %{intensidad} per minute',
  pasoIntensidadDeclarada:
    'declared effort %{esfuerzo} out of 10, equal to %{intensidad} intensity',
  pasoIntensidadTipica: 'typical intensity for this sport, %{intensidad} per minute',
  pasoIntensidadParecida: 'typical intensity for similar activities, %{intensidad} per minute',
  pasoFactorModalidad:
    'x%{factor} because in this sport heart rate usually reads %{metObservado} MET and the table gives %{metOficial}',
  pasoVolumen: '%{minutos} min compressed to %{volumen}',
  pasoDescuentoSinPulso: 'discount for not measuring heart rate, x%{descuento}',
  pasoContraTuBase: 'your average is %{media}, this session %{carga}, so %{signo}%{z}σ',
  pasoSinHistorial: 'no history to compare against yet, so it stays at your average',

  // ── Sueño ────────────────────────────────────────────────────────────────
  suenoTitulo: 'Sleep',
  suenoSubtitulo: '%{n} nights analysed',
  suenoDeCien: 'points out of 100',
  suenoFrase:
    'You go to bed around %{hora}, varying by %{variacion} min. %{cortas} of %{total} nights fall short.',
  suenoPocasNoches: 'At least %{n} nights are needed to measure your schedule.',
  suenoSinDatos: 'No nights recorded yet.',
  suenoSinDatosTexto:
    'Sleep with your band on and your score will show up here, with your schedule and your short nights.',
  suenoLeyendaNoches: 'Recent nights, with the 7 h line. %{n} naps in grey.',
  suenoFormulaRegularidad:
    'you go to bed around %{acostarse}, varying by %{variacionAcostarse} min, and get up around %{levantarse}, varying by %{variacionLevantarse} min',
  suenoFormulaEficiencia:
    'you sleep %{porcentaje} % of your time in bed, with %{despierto} min awake per night',
  suenoFormulaDuracion:
    '%{cumplidas} of %{total} nights reach %{objetivo} h, averaging %{media} h',
  suenoSinTiempoEnCama: 'your tracker is not recording the time you spend in bed',
  suenoRegularidad: 'Regularity',
  suenoDuracion: 'Duration',
  suenoMedia: 'Average',
  suenoEficiencia: 'Efficiency',
  suenoSiestas: 'Naps',
  suenoFases: 'Stages',
  suenoFasesNoPuntuan:
    'Shown for information only. They do not score, because the scientific consensus does not back them as a quality indicator.',
  suenoProfundo: 'Deep',
  suenoRem: 'REM',
  suenoAproximado:
    'Regularity is an approximation from your bed and wake times. The validated index needs minute-by-minute measurement.',

  // ── Salud ────────────────────────────────────────────────────────────────
  saludTitulo: 'Health',
  saludSubtitulo: 'Your weekly target and what your tracker measures. None of this scores.',
  minEquivalentes: 'equivalent moderate min',
  omsCumplido: "You have met the WHO's weekly target.",
  omsFaltan: "You need %{n} more min to hit the WHO's weekly target.",

  // ── Celebration ──────────────────────────────────────────────────────────
  celebraOmsTitulo: 'WHO target met!',
  celebraOmsFrase:
    "You nailed this week's %{n} equivalent moderate minutes! It is the target with the strongest evidence behind it.",
  celebraPrimeroTitulo: "You're first in %{liga}!",
  celebraPrimeroFrase: 'You lead the table with %{p} points. Now defend the crown.',

  rachaTitulo: 'Your streak',
  rachaSemanas: '%{n} weeks in a row hitting the target!',
  rachaUnaSemana: 'One week on target. The streak has begun.',
  rachaCero: 'Your streak starts this week',
  rachaSemanaActual: 'This week is locked in. Nobody can take it from you.',
  rachaVerCiencia: 'See the science',
  rachaArranca:
    'Light the streak this week. Starting already pays: going from inactive to meeting the target is associated with 24% lower mortality.',
  rachaPrimera:
    'First week done! Meeting the WHO target is associated with ~25% lower all-cause mortality.',
  rachaCorta:
    'The streak is growing. Week after week on target is associated with ~25% lower mortality, and every week you add sustains the effect.',
  rachaLarga:
    'Serious streak! You are in the highest-benefit zone: at 2-4 times the target, studies see 26-31% lower mortality.',
  rachaReparada:
    'Pass used, streak saved. One weak week does not erase what you built: the pattern is what counts.',
  rachaComodin: 'You have a pass: one weak week will not break your streak.',
  rachaSinComodin: 'Pass used. Four weeks on target and it is back in your pocket.',

  cierreSemana: "This week's result",
  cierreMes: "This month's result",
  cierreAnio: "This year's result",
  cierreGano: '%{quien} won',
  cierreGanaste: 'You won!',
  cierreTuPuesto: 'You finished %{puesto} with %{p} points',
  palmares: 'Hall of fame',
  semanasGanadas: '%{n} weeks won',
  unaSemanaGanada: 'One week won',
  temporada: '%{anio} season',
  moderada: 'Moderate',
  vigorosa: 'Vigorous',
  diasFuerza: 'Strength days',

  formaTitulo: 'Fitness',
  formaMejora: 'You do the same effort with %{pct} % less heart rate than before.',
  formaPeor: 'The same effort costs you %{pct} % more heart rate than before.',
  formaIgual: 'Your cardiac cost is practically the same as before.',
  formaDetalle: 'In %{liga} you have gone from %{antes} to %{ahora} %{unidad} on average.',
  formaPocoFiable: 'With only %{n} comparable sessions the signal is weak. More history is needed.',
  formaPocasSesiones:
    'At least %{minimo} sessions with pace and heart rate are needed to measure your fitness. You have %{n}.',

  tuCuerpo: 'Your body',
  tuCuerpoSub: 'Each reading is compared with your usual range over the last 90 days.',
  metricaHrv: 'Heart rate variability',
  metricaFcReposo: 'Resting heart rate',
  metricaSpo2: 'Blood oxygen',
  metricaRespiracion: 'Respiratory rate',
  metricaVo2max: 'VO₂ max',
  metricaPasos: 'Steps',
  lpm: 'bpm',
  rpm: 'brpm',
  sinDatosMetrica: 'no data',
  estadoDentro: 'within your usual range',
  estadoMejor: 'better than usual',
  estadoPeor: 'worse than usual',
  estadoSinBanda: 'no reference range yet',
  rangoHabitual: 'your normal runs from %{min} to %{max}',
  estable: 'steady',
  subiendo: 'up %{n}',
  bajando: 'down %{n}',
  avisoModelo: 'This value is calculated by a model, not measured by the sensor. Watch the trend.',
  coberturaAviso:
    'A day with no data means you were not wearing your tracker, not a zero. And if a metric is missing, your tracker may not be writing it to Health.',

  tuBase: 'Your baseline',
  baseCalculada: 'Calculated from your last %{n} sessions.',
  cargaMedia: 'Average load',
  tuRangoCarga: 'Your range',
  basePocoFiable: 'With fewer than 10 sessions this baseline shifts noticeably as new data arrives.',

  // ── Ciencia ──────────────────────────────────────────────────────────────
  enQueNosBasamos: 'What this is based on',
  cienciaSubtitulo: '%{n} decisions and their source',
  basadoEn: 'Based on',
  cerrar: 'Close',

  verDiagnostico: 'See the data diagnostic',

  // ── Compete ──────────────────────────────────────────────────────────────
  competi: 'Compete',
  vasPrimero: "You're first with %{p} points. Hold on, %{quien} is coming for you.",
  vasPrimeroSolo: 'Leading solo with %{p} points. Bring in rivals and defend the throne.',
  teFaltan: '%{p} points from catching %{quien}. One good session and you are past them.',
  noParticipas: 'No points here yet this week. Your first session puts you in the fight.',
  agregarAmigos: 'Add friends',
  tuPerfil: 'Your profile',
  sinServidor: 'No server',
  liga: 'League',
  periodo: 'Period',
  unMiembro: '1 member',
  nMiembros: '%{n} members',
  ligaVaciaTitulo: "You're still competing alone",
  ligaVaciaTexto:
    'Share code %{codigo} on WhatsApp and fill this with rivals, or search someone by username.',
  progresoMejor: 'Your last %{deporte} was harder than usual for you. Your normal runs from %{min} to %{max} of load.',
  progresoIgual: 'Your last %{deporte} is within your usual range, from %{min} to %{max} of load.',
  progresoPeor: 'Your last %{deporte} was easier than usual for you. Your normal runs from %{min} to %{max} of load.',
  sinServidorTexto:
    'The Supabase keys are not reaching the app. In development it is almost always Metro starting without reloading .env.',
  sinConexionTitulo: 'No connection',
  sinConexionTexto:
    'Your account is still here, but we cannot reach the server right now. Check your network and try again.',
  reintentar: 'Try again',
  sinLiga: 'Your first league is one tap away',
  sinLigaTexto:
    'Create yours and share the code, or join with one you got. In two minutes you are competing.',
  crearLiga: 'Create a league',
  tengoCodigo: 'I have a code',
  crearOtra: 'Create another league',
  entrarConCodigo: 'Join with a code',
  nadiePuntua:
    'Nobody has scored in this window yet. Open the scoring: numbers show up once each person opens the app.',
  deN: 'of',
  conPuntos: 'with %{p} points',
  unaSesion: '1 session',
  nSesiones: '%{n} sessions',
  semanaFuerte: 'strong week',
  codigoDe: '%{liga} code: %{codigo}',
  compartirLiga: 'Share',

  // ── New league ───────────────────────────────────────────────────────────
  crearTitulo: 'Create a league',
  crearTexto: 'Name it and choose whether it counts everything or one sport.',
  nombreLigaEjemplo: 'Thursday crew',
  deporte: 'Sport',
  generalTexto:
    'The overall league counts any activity. A barre class can score more than an easy run.',
  crear: 'Create',
  cancelar: 'Cancel',
  ligaCreada: 'League created',
  ligaCreadaTexto:
    'Share the invite: the link carries the code. Without the code the league is invisible.',
  compartirCodigo: 'Share the invite',
  invitacion:
    'I challenge you in “%{liga}”, my Compety league. Tap the link or join with code %{codigo}: %{enlace}',
  verClasificacion: 'See the ranking',
  entrarTitulo: 'Join a league',
  entrarTexto: 'Type the six character code you were given.',
  entrar: 'Join',

  // ── Friends ──────────────────────────────────────────────────────────────
  amigos: 'Friends',
  buscarPlaceholder: 'exact username',
  buscar: 'Search',
  buscarPista:
    'You need the full username. No suggestions, so nobody can browse who uses the app.',
  noHallado: 'Nobody with that username.',
  agregar: 'Add',
  aceptar: 'Accept',
  no: 'No',
  retirar: 'Withdraw',
  invitar: 'Invite',
  pendiente: 'Pending',
  yaAmigos: 'Friends',
  eresTu: "That's you",
  peticionEnviada: 'Request sent.',
  yaSoisAmigos: "You're friends now.",
  teHanAgregado: 'Friend requests',
  tusAmigos: 'Your friends',
  sinAmigos: 'No friends here yet',
  sinAmigosTexto:
    'Search someone by username, or share your league code on WhatsApp, which is faster for a whole group.',
  esperandoRespuesta: 'Waiting for a reply',
  invitarA: 'Invite to:',
  entraEn: '%{quien} joins %{liga}.',

  // ── Zone leagues ─────────────────────────────────────────────────────────
  tuZona: 'Your area',
  zonaTitulo: 'Compete in your area',
  zonaTexto:
    "Join your city's public league, and your neighbourhood's if you want. Every week the top players move up a division and the bottom ones move down.",
  zonaPrivacidad:
    'Your location is only used here, to suggest your area. It is never stored and never leaves your iPhone: only the name you confirm goes to the server.',
  usarUbicacion: 'Use my location',
  ubicacionBuscando: 'Finding your area…',
  ubicacionDenegada:
    'No location permission. You can grant it in Settings, or type your area below.',
  ubicacionSinResultado: "We couldn't detect your area. Type it below.",
  ciudad: 'City',
  ciudadEjemplo: 'Madrid',
  distrito: 'District or neighbourhood',
  distritoOpcional: 'Optional. With a district you compete in two tables: your neighbourhood and your city.',
  distritoEjemplo: 'Chamberí',
  usarTexto: 'Use "%{texto}"',
  unirmeAZona: 'Join my area',
  zonaLista: "You're in",
  zonaListaTexto: 'You compete in %{zonas}. The round closes every Monday.',
  cambiarZona: 'Change area',
  salirDeZona: 'Leave area leagues',
  salirDeZonaAviso: 'You leave the public leagues of your area. Your private leagues are untouched.',
  division: 'Division %{n}',
  divisionCorta: 'Div. %{n}',
  zonaSube: 'Up',
  zonaBaja: 'Down',
  zonaJornada: 'Monday decides everything: top %{s} move up and bottom %{b} drop.',
  zonaJornadaSoloSube: 'Top %{s} move up on Monday. Fight for your spot.',
  zonaJornadaSoloBaja: 'Bottom %{b} drop on Monday. Do not get caught down there.',
  zonaJornadaUnoSube: 'First place moves up on Monday. It could be you.',
  zonaJornadaUnoBaja: 'Last place drops on Monday. Get out of there.',
  zonaPocos: 'With fewer than 4 people the round does not start. Bring your people and let the fight begin.',
  celebraAscensoTitulo: 'Promoted in %{zona}!',
  celebraAscensoFrase: 'Huge week! You finished among the top and now compete in Division %{n}.',
  noticiaDescenso: 'You drop to Division %{n} in %{zona}. Nothing one good week cannot fix: the comeback starts today.',

  // ── Profile ──────────────────────────────────────────────────────────────
  nombreVisible: 'Display name',
  nombreVisibleCorto: 'What others see in the ranking.',
  nombreUsuario: 'Username',
  guardarNombre: 'Save name',
  guardarUsuario: 'Save username',
  nombreGuardado: 'Name saved.',
  usuarioGuardado: 'Username saved.',
  ajustes: 'Settings',
  idioma: 'Language',
  idiomaPista: 'Applies right away, no need to restart the app.',
  cuenta: 'Account',
  cuentaTexto:
    'Your health data stays on your iPhone. Your score goes to the server and, for each workout, the sport and the time.',
  cerrarSesion: 'Sign out',
  borrarCuenta: 'Delete account',
  borrarAviso:
    'Your account, name, scores, friends and league memberships are removed. This cannot be undone.',
  borrar: 'Delete',
  volverA: '‹ %{donde}',
  atras: 'Back',

  // ── Friends feed (second page of Compete) ────────────────────────────────
  paraTi: 'For you',
  feedAmigos: 'Friends',
  feedVacio: 'Your people’s workouts will show up here',
  feedVacioTexto:
    'From your friends and from whoever competes with you in a private league. Every workout can be cheered and commented on.',
  feedSinGente: 'You are not following anyone yet: add friends or invite someone to your league.',
  feedPrivacidad: 'Your workouts are seen by your friends and your private leagues. Never by area leagues.',
  feedTuEntreno: 'You',
  feedSesionFuerte: 'hard session',
  feedSesionNormal: 'regular session',
  feedSesionSuave: 'easy session',
  feedAhora: 'just now',
  feedHaceMin: '%{n} min ago',
  feedHaceHoras: '%{n} h ago',
  feedAyer: 'yesterday',
  feedHaceDias: '%{n} days ago',
  feedComentarios: 'Comments',
  feedUnComentario: '1 comment',
  feedNComentarios: '%{n} comments',
  feedComentar: 'Comment',
  feedEscribe: 'Write something…',
  feedEnviar: 'Send',
  feedSinComentarios: 'No comments yet. Be the first.',
  feedReaccionaron: 'Reactions from',
  feedReaccionar: 'React',
  feedQuitar: 'Remove from feed',
  feedQuitarAviso: 'This workout disappears from everyone’s feed, with its reactions and comments.',
  feedCargarMas: 'Load more',
  feedError: 'Could not load the feed. Pull down to try again.',

  // ── A person's page (their workouts) ─────────────────────────────────────
  personaEntrenos: 'Their workouts',
  personaSinEntrenos: 'No workouts published yet. They will show up here once they open the app.',
  personaOculta:
    'Only your friends and the people who compete with you in a private league show you their workouts. You share an area league, so you cannot see theirs yet.',
  personaPedir: 'Send friend request',
  personaPedida: 'Request sent. Once they accept, their workouts will show up here.',
  personaTusEntrenos: 'Your workouts, as your people see them.',
};

/**
 * Sustituye %{clave} por su valor. Lo minimo para no repetir plantillas a mano.
 *
 * ⚠️ No es una libreria de i18n con plurales: para eso ya hay `unaSesion` y `nSesiones` como
 * claves separadas, que es mas explicito y no arrastra una dependencia mas.
 */
export function conValores(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/%\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? ''));
}

/**
 * Idioma a usar: el del iPhone si es espanol, ingles en cualquier otro caso.
 *
 * ⭐ El ingles manda por defecto, y es decision de producto: el mercado es internacional y una app
 * que se abre en espanol a un anglofono parece rota.
 *
 * ⚠️ Aqui estaba el bug que el usuario reporto como "la app se abre en espanol": la deteccion
 * FUNCIONABA, lo que fallaba es que las pantallas nuevas traian los textos escritos a fuego en
 * espanol. El sintoma que lo delataba: los deportes salian en ingles (`Overall`, `Padel`) porque
 * esos si pasan por `nombreLiga()`, mientras el titulo de al lado seguia en espanol.
 *
 * 📌 Regla: ningun texto visible se escribe dentro de una pantalla. Va aqui o en `i18n/ligas.ts`.
 */
export function idiomaDelSistema(): Idioma {
  const codigo = getLocales()[0]?.languageCode;
  return codigo === 'es' ? 'es' : 'en';
}

/**
 * Idioma elegido a mano, que gana sobre el del sistema.
 *
 * ⭐ El selector ES/EN estaba en la maqueta y faltaba en la app. No es un capricho: en una app que
 * se va a probar con gente, poder cambiar el idioma sin salir a Ajustes del iPhone ahorra explicar
 * nada. Y para desarrollo permite revisar los dos idiomas sin tocar el dispositivo.
 *
 * ⚠️ Vive en una variable de modulo y NO en `useState` porque `textos()` se llama desde funciones
 * sueltas que no son componentes. El re-render lo fuerza quien cambia el idioma, subiendo su propio
 * estado. Es la solucion mas simple que no arrastra un contexto de React por toda la app.
 */
let elegido: Idioma | null = null;

/** Idioma en uso: el elegido a mano si hay, y si no el del sistema. */
export function idiomaActual(): Idioma {
  return elegido ?? idiomaDelSistema();
}

export function eligeIdioma(idioma: Idioma): void {
  elegido = idioma;
}

export function textos(idioma: Idioma = idiomaActual()) {
  return idioma === 'es' ? ES : EN;
}

/**
 * Tipo de la tabla de textos.
 *
 * ⚠️ `typeof ES` a secas NO sirve: al ser `as const`, fija cada valor a su literal en espanol, y
 * pasar la tabla como prop daba `Type 'string' is not assignable to type 'Compite por lo que te
 * cuesta'`. Lo que importa es que estan todas las claves y que son textos, no cual es el texto.
 */
export type Textos = Record<keyof typeof ES, string>;
