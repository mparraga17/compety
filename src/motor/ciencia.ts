/**
 * Fuentes que sostienen cada regla del motor.
 *
 * Por que viven en el codigo y no en un documento aparte: el estudio JAMIA con 18 usuarios
 * reales de Fitbit senala los scores opacos como el mayor problema de confianza. Cada paso
 * del desglose que ve el usuario apunta a una de estas entradas por su `id`.
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

export const CIENCIA = {
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
  vilpa: {
    dato: 'Tres tandas diarias de uno o dos minutos intensos ya cuentan',
    detalle:
      'Hablamos de actividad vigorosa de la vida cotidiana, sin llegar a ser deporte. Se asocia a entre un 38 y un 40 % menos de mortalidad total.',
    fuente: 'Nature Medicine 2022',
    url: 'https://www.nature.com/articles/s41591-022-02100-x',
  },
} as const satisfies Record<string, Fuente>;

export type ClaveCiencia = keyof typeof CIENCIA;
