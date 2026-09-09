import type { Idioma } from '../i18n/textos';

/**
 * Fuentes que sostienen cada regla del motor.
 *
 * Por que viven en el codigo y no en un documento aparte: el estudio JAMIA con 18 usuarios
 * reales de Fitbit senala los scores opacos como el mayor problema de confianza. Cada paso
 * del desglose que ve el usuario apunta a una de estas entradas por su `id`.
 *
 * ⭐⭐ EN LOS DOS IDIOMAS, y esto era un bug real que vio el usuario: con la app en ingles la
 * hoja "What this is based on" salia entera en espanol. La causa es la regla que este proyecto
 * ya aprendio una vez con el `nombre: 'Tú'` del `build.js`:
 *
 *   ⛔ UN DATO NUNCA DEBE LLEVAR TEXTO TRADUCIBLE DENTRO.
 *
 * Aqui el "dato" es la ficha cientifica. Vive en el motor porque el texto tiene que ir con la
 * regla que lo sostiene, asi que la solucion no es moverlo a `textos.ts` sino tener las dos
 * versiones y resolverlas con `fichaDe(clave, idioma)`.
 *
 * ⚠️ `fuente` NO se traduce a proposito: son nombres de revista y de cohorte, que son los
 * mismos en cualquier idioma. Traducir "JAMA Intern Med" seria inventar una cita.
 *
 * Regla de estilo del producto: sin guiones largos, sin flechas y sin construcciones del
 * tipo "no es X, es Y". Frases naturales y directas.
 */

export type Fuente = {
  dato: string;
  detalle: string;
  fuente: string;
  url: string | null;
};

const ES = {
  edwards: {
    dato: 'Los minutos duros pesan más que los suaves',
    detalle:
      'Método Edwards, que multiplica los minutos de cada zona de pulso por el número de zona y los suma. Está publicado y se usa como medida de referencia en investigación.',
    fuente: 'JSCR 2012, validez convergente con Banister TRIMP',
    url: 'https://journals.lww.com/nsca-jscr/Fulltext/2012/01000/The_Convergent_Validity_between_Two_Objective.27.aspx',
  },
  intervalico: {
    dato: 'Sumar por zonas mide mejor que promediar el pulso',
    detalle:
      'Un pulso medio mezcla el esfuerzo con el descanso y se queda corto. En pádel solo el 40 % del partido es juego efectivo, así que la media dice poco.',
    fuente: 'PubMed 2014, 328 sesiones. Applied Sciences 2023',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24942164/',
  },
  isometrico: {
    dato: 'El pulso se queda corto con la fuerza',
    detalle:
      'El pulso refleja la demanda cardiovascular, y la fuerza es sobre todo neuromuscular. La corrección al alza va declarada y se puede ver aquí mismo.',
    fuente: 'PMC 2019, wearables en resistencia de baja intensidad',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6705857/',
  },
  fuerzaSalud: {
    dato: 'La fuerza tiene su propio beneficio, del 10 al 17 % menos mortalidad',
    detalle:
      'Es un efecto independiente del ejercicio aeróbico. Por eso entrenar fuerza tiene que puntuar de verdad.',
    fuente: 'BJSM 2022, revisión sistemática y metaanálisis',
    url: 'https://bjsm.bmj.com/content/56/13/755',
  },
  compendium: {
    dato: 'Cada deporte tiene un coste energético medido en laboratorio',
    detalle:
      'El Compendium de Actividades Físicas recoge 1114 actividades, 912 de ellas con el gasto medido por calorimetría indirecta. De ahí sale el peso de cada deporte. Algunos valores: correr 9,8 MET, tenis 8,0, pádel 6,8, fuerza 6,0, golf andando 4,3, caminar 3,8 y pilates 2,8.',
    fuente: '2024 Adult Compendium, J Sport Health Sci 2024',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38242596/',
  },
  dosisRespuesta: {
    dato: 'La primera hora aporta más que la cuarta',
    detalle:
      'El beneficio del ejercicio no crece en línea recta. Empieza a notarse desde unos 2.600 pasos al día y se va aplanando hacia los 8.800. Por eso el tiempo cuenta, aunque cada hora extra pese algo menos que la anterior.',
    fuente: 'JACC 2023, metaanálisis de dosis y respuesta',
    url: 'https://www.jacc.org/doi/10.1016/j.jacc.2023.07.029',
  },
  basePropia: {
    dato: 'Cada persona se compara consigo misma',
    detalle:
      'Ninguna fórmula de pulso máximo acierta a nivel individual, y Fitbit se queda hasta 16 lpm por debajo cuando la intensidad es alta. Comparar valores absolutos entre personas daría una precisión que no existe.',
    fuente: 'JSCR 2015 y Gulati, Northwestern',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25932986/',
  },
  fcReposo: {
    dato: 'Un pulso en reposo más bajo se asocia a menos mortalidad',
    detalle:
      'Cada 10 lpm de más en reposo se asocia a un riesgo relativo de 1,09 de mortalidad por cualquier causa. Los propios autores avisan de heterogeneidad y sesgo de publicación.',
    fuente: 'CMAJ 2016, metaanálisis con 1.246.203 personas',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4754196/',
  },
  eficiencia: {
    dato: 'Entrenar baja el pulso haciendo el mismo esfuerzo',
    detalle:
      'En un ensayo de 12 semanas el pulso en reposo bajó de 4 a 5 lpm, y caminando a la misma velocidad bajó 3 lpm. De ahí sale la idea de medir la mejora por el pulso que te cuesta el mismo trabajo.',
    fuente: 'Eur J Appl Physiol 2017, ensayo aleatorizado con 45 mujeres',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28932907/',
  },
  oms: {
    dato: 'De 150 a 300 minutos semanales de intensidad moderada',
    detalle:
      'La alternativa son de 75 a 150 minutos de intensidad vigorosa, más dos días de fortalecimiento. Es un objetivo externo y verificable, no uno que nos hayamos inventado.',
    fuente: 'Organización Mundial de la Salud',
    url: 'https://www.who.int/initiatives/behealthy/physical-activity',
  },
  competicion: {
    dato: 'Competir fue el único formato cuyo efecto duró',
    detalle:
      'Se probaron cuatro formatos con 602 adultos: control, apoyo, colaboración y competición. Al retirar la gamificación, solo el grupo de competición mantuvo la actividad alta.',
    fuente: 'STEP UP, JAMA Intern Med 2019, 602 adultos',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31498375/',
  },
  tope: {
    dato: 'Concentrar el ejercicio en pocos días cuenta igual que repartirlo',
    detalle:
      'En una cohorte de 350.978 adultos, quienes hacían todo su ejercicio en una o dos sesiones tuvieron la misma mortalidad que quienes lo repartían, siempre que el total fuera el mismo. Por eso cuentan tus mejores sesiones y no el número de veces que sales.',
    fuente: 'JAMA Intern Med 2022, 350.978 adultos. Replicado con acelerómetro en JAHA 2025',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35788615/',
  },
  volumen: {
    dato: 'El tiempo total pesa más que la intensidad',
    detalle:
      'En nueve cohortes con acelerómetro y 46.682 personas, más volumen de actividad se asoció a bastante menos mortalidad, y subir la intensidad manteniendo el mismo volumen aportó bastante menos. Una jornada larga y tranquila puede sumar más que una sesión corta y dura.',
    fuente: 'Am J Prev Med 2024, metaanálisis de 9 cohortes, 46.682 adultos',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39089430/',
  },
  constancia: {
    dato: 'Salir a menudo suma, aunque no decide',
    detalle:
      'La mortalidad no distingue entre concentrar el ejercicio y repartirlo, así que el extra por constancia se queda pequeño y con techo. Lo que sí sube al concentrar todo en un día es el riesgo de lesión, y por eso el extra existe.',
    fuente: 'JAMA Intern Med 2022 y guías OMS de regularidad',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35788615/',
  },
  // ── Sueño ────────────────────────────────────────────────────────────────
  regularidad: {
    dato: 'Acostarse y levantarse a la misma hora importa más que dormir mucho',
    detalle:
      'En esta cohorte la regularidad predijo la mortalidad mejor que la duración. Quienes mantenían horarios más constantes tuvieron entre un 20 y un 48 % menos de mortalidad por cualquier causa que los más irregulares.',
    fuente: 'Sleep 2024, 60.977 personas de UK Biobank medidas con acelerómetro',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37738616/',
  },
  regularidad2: {
    dato: 'Confirmado en una segunda cohorte independiente',
    detalle:
      'Con 88.975 participantes, quienes estaban en el percentil 5 de regularidad tuvieron un riesgo 1,53 veces mayor que la mediana. La relación no es lineal, así que lo que más cuenta es evitar la irregularidad extrema.',
    fuente: 'eLife 2023, 88.975 personas de UK Biobank',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37995126/',
  },
  eficienciaSueno: {
    dato: 'Cuánto duermes del tiempo que pasas en la cama',
    detalle:
      'Un panel de expertos revisó 277 estudios y coincidió en que la eficiencia, el tiempo que tardas en dormirte y los despertares de más de 5 minutos sirven como indicadores de calidad del sueño. Aquí se mide entre el 85 y el 100 %, que es el rango donde la pulsera distingue de verdad.',
    fuente: 'National Sleep Foundation 2017, consenso Delphi RAND/UCLA',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28346153/',
  },
  duracion: {
    dato: 'Las 7 horas son el umbral que aparece en la literatura',
    detalle:
      'Dormir 7 horas o menos de forma sostenida durante al menos 14 días se asoció a 1,7 veces más riesgo de lesión muscular. Se cuentan noches en lugar de promediar, porque una media buena puede esconder varias noches cortas. Es una asociación de población, no un pronóstico personal.',
    fuente: 'PubMed 2021, revisión',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34099605/',
  },
  fasesSinConsenso: {
    dato: 'Las fases se muestran, aunque no puntúan',
    detalle:
      'Ese mismo panel no llegó a un acuerdo sobre si el sueño profundo o el REM sirven como indicadores de calidad. Puntuar con ellos daría una precisión que la evidencia no respalda, así que se quedan como información.',
    fuente: 'National Sleep Foundation 2017',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28346153/',
  },
  precisionSueno: {
    dato: 'La pulsera no es un laboratorio del sueño',
    detalle:
      'Las revisiones que comparan wearables con polisomnografía ven que aciertan bastante con el tiempo total, y que fallan más al repartir las fases. Es otro motivo para no puntuar el sueño profundo ni el REM.',
    fuente: 'JMIR 2024, revisión sistemática',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11004611/',
  },
  // ── Salud ────────────────────────────────────────────────────────────────
  banda: {
    dato: 'Tu rango habitual es tu propia referencia',
    detalle:
      'La banda de fondo es tu media más y menos una desviación típica de los últimos 90 días. Dentro de ella el dato es normal para ti, y solo se marca con color cuando se sale. Responde al problema que más repiten los usuarios de wearables: no saber qué es normal en su caso.',
    fuente: 'JAMIA 2023, estudio cualitativo con 18 usuarios de Fitbit',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36795067/',
  },
  hrv: {
    dato: 'La variabilidad del pulso refleja tu estado del día',
    detalle:
      'Mide la diferencia entre latidos y varía mucho de una persona a otra, así que solo tiene sentido comparada contigo mismo. Baja con el estrés, el alcohol y el mal dormir. No sirve para diagnosticar nada.',
    fuente: 'Front Physiol, revisión de HRV en wearables',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5900369/',
  },
  spo2: {
    dato: 'La saturación de oxígeno se mueve muy poco',
    detalle:
      'En una persona sana se queda entre el 95 y el 100 %, así que un cambio de medio punto no significa gran cosa. Se muestra por contexto, no como señal de alarma.',
    fuente: 'Organización Mundial de la Salud, referencia de pulsioximetría',
    url: 'https://www.who.int/',
  },
  respiracion: {
    dato: 'La respiración nocturna es estable y delata los cambios',
    detalle:
      'En reposo suele quedarse en un rango estrecho, así que subir de golpe suele acompañar a un resfriado, al alcohol o a dormir mal. Es contexto, no un diagnóstico.',
    fuente: 'Nature Sci Rep 2020, respiración nocturna con wearables',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7060247/',
  },
  vo2max: {
    dato: 'El VO2max lo estima un modelo, no lo mide el sensor',
    detalle:
      'La pulsera lo calcula en la nube a partir de tu pulso y tu ritmo, así que es una estimación y no una medida de laboratorio. Sirve para ver la tendencia, no para fiarse del número exacto.',
    fuente: 'Google Health API, campo calculado con covarianza declarada',
    url: null,
  },
  pasos: {
    dato: 'El beneficio empieza mucho antes de los 10.000 pasos',
    detalle:
      'En un metaanálisis con más de 200.000 personas la mortalidad ya baja desde unos 2.600 pasos al día y se va aplanando hacia los 8.800. Los 10.000 son una cifra de marketing, no un umbral científico.',
    fuente: 'JACC 2023, metaanálisis de dosis y respuesta',
    url: 'https://www.jacc.org/doi/10.1016/j.jacc.2023.07.029',
  },
  vilpa: {
    dato: 'Tres tandas diarias de uno o dos minutos intensos ya cuentan',
    detalle:
      'Hablamos de actividad vigorosa de la vida cotidiana, sin llegar a ser deporte. Se asocia a entre un 38 y un 40 % menos de mortalidad total.',
    fuente: 'Nature Medicine 2022',
    url: 'https://www.nature.com/articles/s41591-022-02100-x',
  },
} as const satisfies Record<string, Fuente>;

export type ClaveCiencia = keyof typeof ES;

/**
 * Versión inglesa. `fuente` se copia tal cual: son nombres de revista y de cohorte.
 *
 * ⚠️ Tipada como `Record<ClaveCiencia, Fuente>` a propósito: si se añade una ficha en español y
 * se olvida aquí, no compila. Es la red de seguridad que faltaba y por eso salió el bug.
 */
const EN: Record<ClaveCiencia, Fuente> = {
  edwards: {
    dato: 'Hard minutes count for more than easy ones',
    detalle:
      'The Edwards method multiplies the minutes in each heart rate zone by the zone number and adds them up. It is published and used as a reference measure in research.',
    fuente: ES.edwards.fuente,
    url: ES.edwards.url,
  },
  intervalico: {
    dato: 'Adding up zones measures better than averaging heart rate',
    detalle:
      'An average heart rate mixes effort with rest and falls short. In padel only 40 % of the match is actual play, so the average says very little.',
    fuente: ES.intervalico.fuente,
    url: ES.intervalico.url,
  },
  isometrico: {
    dato: 'Heart rate falls short with strength work',
    detalle:
      'Heart rate reflects cardiovascular demand, and strength work is mostly neuromuscular. The upward correction is declared and you can see it right here.',
    fuente: ES.isometrico.fuente,
    url: ES.isometrico.url,
  },
  fuerzaSalud: {
    dato: 'Strength has its own benefit, 10 to 17 % lower mortality',
    detalle:
      'It is an effect independent of aerobic exercise. That is why strength training has to score properly.',
    fuente: ES.fuerzaSalud.fuente,
    url: ES.fuerzaSalud.url,
  },
  compendium: {
    dato: 'Every sport has an energy cost measured in a lab',
    detalle:
      'The Compendium of Physical Activities lists 1114 activities, 912 of them with expenditure measured by indirect calorimetry. That is where each sport weight comes from. Some values: running 9.8 MET, tennis 8.0, padel 6.8, strength 6.0, golf walking 4.3, walking 3.8 and pilates 2.8.',
    fuente: ES.compendium.fuente,
    url: ES.compendium.url,
  },
  dosisRespuesta: {
    dato: 'The first hour gives you more than the fourth',
    detalle:
      'Exercise benefit does not grow in a straight line. It starts showing from around 2,600 steps a day and flattens out towards 8,800. Time counts, but each extra hour weighs a little less than the one before.',
    fuente: ES.dosisRespuesta.fuente,
    url: ES.dosisRespuesta.url,
  },
  basePropia: {
    dato: 'Everyone is compared against themselves',
    detalle:
      'No maximum heart rate formula works at an individual level, and Fitbit reads up to 16 bpm low when intensity is high. Comparing absolute values between people would imply a precision that does not exist.',
    fuente: ES.basePropia.fuente,
    url: ES.basePropia.url,
  },
  fcReposo: {
    dato: 'A lower resting heart rate is linked to lower mortality',
    detalle:
      'Every 10 bpm above resting is associated with a relative risk of 1.09 for all-cause mortality. The authors themselves flag heterogeneity and publication bias.',
    fuente: ES.fcReposo.fuente,
    url: ES.fcReposo.url,
  },
  eficiencia: {
    dato: 'Training lowers your heart rate for the same effort',
    detalle:
      'In a 12 week trial resting heart rate dropped by 4 to 5 bpm, and walking at the same speed it dropped 3 bpm. That is where the idea of measuring progress by the pulse the same work costs you comes from.',
    fuente: ES.eficiencia.fuente,
    url: ES.eficiencia.url,
  },
  oms: {
    dato: '150 to 300 minutes a week of moderate intensity',
    detalle:
      'The alternative is 75 to 150 minutes of vigorous intensity, plus two days of strengthening. It is an external, verifiable target, not one we made up.',
    fuente: 'World Health Organization',
    url: ES.oms.url,
  },
  competicion: {
    dato: 'Competition was the only format whose effect lasted',
    detalle:
      'Four formats were tested with 602 adults: control, support, collaboration and competition. When the gamification was switched off, only the competition group kept its activity high.',
    fuente: ES.competicion.fuente,
    url: ES.competicion.url,
  },
  tope: {
    dato: 'Packing exercise into a few days counts the same as spreading it out',
    detalle:
      'In a cohort of 350,978 adults, those doing all their exercise in one or two sessions had the same mortality as those spreading it out, as long as the total was the same. That is why your best sessions count and not how many times you go out.',
    fuente: ES.tope.fuente,
    url: ES.tope.url,
  },
  volumen: {
    dato: 'Total time weighs more than intensity',
    detalle:
      'Across nine accelerometer cohorts and 46,682 people, more activity volume was linked to considerably lower mortality, while raising intensity at the same volume added considerably less. A long easy day can add up to more than a short hard session.',
    fuente: ES.volumen.fuente,
    url: ES.volumen.url,
  },
  constancia: {
    dato: 'Going out often adds up, though it does not decide',
    detalle:
      'Mortality does not distinguish between packing exercise together and spreading it out, so the consistency bonus stays small and capped. What does go up when you pack it all into one day is injury risk, and that is why the bonus exists.',
    fuente: ES.constancia.fuente,
    url: ES.constancia.url,
  },
  regularidad: {
    dato: 'Going to bed and getting up at the same time matters more than sleeping a lot',
    detalle:
      'In this cohort regularity predicted mortality better than duration. Those keeping more consistent schedules had between 20 and 48 % lower all-cause mortality than the most irregular.',
    fuente: ES.regularidad.fuente,
    url: ES.regularidad.url,
  },
  regularidad2: {
    dato: 'Confirmed in a second independent cohort',
    detalle:
      'With 88,975 participants, those in the 5th percentile of regularity had a risk 1.53 times higher than the median. The relationship is not linear, so what counts most is avoiding extreme irregularity.',
    fuente: ES.regularidad2.fuente,
    url: ES.regularidad2.url,
  },
  eficienciaSueno: {
    dato: 'How much of your time in bed you actually sleep',
    detalle:
      'An expert panel reviewed 277 studies and agreed that efficiency, how long you take to fall asleep and awakenings over 5 minutes work as sleep quality indicators. Here it is measured between 85 and 100 %, which is the range where a tracker really tells nights apart.',
    fuente: ES.eficienciaSueno.fuente,
    url: ES.eficienciaSueno.url,
  },
  duracion: {
    dato: '7 hours is the threshold that shows up in the literature',
    detalle:
      'Sleeping 7 hours or less consistently for at least 14 days was linked to 1.7 times higher muscle injury risk. Nights are counted rather than averaged, because a good average can hide several short nights. It is a population association, not a personal forecast.',
    fuente: ES.duracion.fuente,
    url: ES.duracion.url,
  },
  fasesSinConsenso: {
    dato: 'Sleep stages are shown, though they do not score',
    detalle:
      'That same panel did not reach agreement on whether deep sleep or REM work as quality indicators. Scoring with them would imply a precision the evidence does not support, so they stay as information.',
    fuente: ES.fasesSinConsenso.fuente,
    url: ES.fasesSinConsenso.url,
  },
  precisionSueno: {
    dato: 'Your tracker is not a sleep lab',
    detalle:
      'Reviews comparing wearables against polysomnography find they do reasonably well on total time and worse at splitting stages. That is another reason not to score deep sleep or REM.',
    fuente: ES.precisionSueno.fuente,
    url: ES.precisionSueno.url,
  },
  banda: {
    dato: 'Your usual range is your own reference',
    detalle:
      'The background band is your average plus and minus one standard deviation over the last 90 days. Inside it the reading is normal for you, and colour only appears when it steps outside. It answers what wearable users report most: not knowing what normal looks like for them.',
    fuente: ES.banda.fuente,
    url: ES.banda.url,
  },
  hrv: {
    dato: 'Heart rate variability reflects how your day is going',
    detalle:
      'It measures the difference between beats and varies a lot between people, so it only makes sense compared against yourself. It drops with stress, alcohol and poor sleep. It cannot diagnose anything.',
    fuente: ES.hrv.fuente,
    url: ES.hrv.url,
  },
  spo2: {
    dato: 'Oxygen saturation barely moves',
    detalle:
      'In a healthy person it stays between 95 and 100 %, so half a point of change means very little. It is shown for context, not as an alarm.',
    fuente: 'World Health Organization, pulse oximetry reference',
    url: ES.spo2.url,
  },
  respiracion: {
    dato: 'Night-time breathing is steady and gives changes away',
    detalle:
      'At rest it usually stays in a narrow range, so a sudden rise tends to come with a cold, alcohol or a bad night. It is context, not a diagnosis.',
    fuente: ES.respiracion.fuente,
    url: ES.respiracion.url,
  },
  vo2max: {
    dato: 'VO2max is estimated by a model, not measured by the sensor',
    detalle:
      'Your tracker works it out in the cloud from your heart rate and pace, so it is an estimate and not a lab measurement. Use it for the trend, not for the exact number.',
    fuente: 'Google Health API, calculated field with declared covariance',
    url: null,
  },
  pasos: {
    dato: 'The benefit starts well before 10,000 steps',
    detalle:
      'In a meta-analysis of more than 200,000 people mortality already drops from around 2,600 steps a day and flattens out towards 8,800. The 10,000 figure is marketing, not a scientific threshold.',
    fuente: ES.pasos.fuente,
    url: ES.pasos.url,
  },
  vilpa: {
    dato: 'Three daily bursts of one or two intense minutes already count',
    detalle:
      'This is vigorous activity from everyday life, without it being sport. It is associated with 38 to 40 % lower all-cause mortality.',
    fuente: ES.vilpa.fuente,
    url: ES.vilpa.url,
  },
};

/** Ficha en el idioma pedido. Es el único acceso: no exportamos las tablas. */
export function fichaDe(clave: ClaveCiencia, idioma: Idioma): Fuente {
  return idioma === 'es' ? ES[clave] : EN[clave];
}

/** Si una clave existe. Permite pedir fichas sin romper si alguna no está portada. */
export function hayFicha(clave: string): clave is ClaveCiencia {
  return clave in ES;
}
