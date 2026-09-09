import {
  canonicaliza,
  claveDeCiudad,
  distritosDeCatalogo,
  filtraOpciones,
  fusionaCiudades,
  fusionaDistritos,
  parteCoincidente,
} from './distritos';

/**
 * Tests del catálogo de zonas, su fusión con las ligas vivas del servidor y el filtro del
 * buscador. Fijan la garantía que sostiene los dos campos: la convergencia por clave
 * normalizada, tecleen como tecleen.
 */

describe('claveDeCiudad', () => {
  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(claveDeCiudad('MADRID')).toBe('madrid');
    expect(claveDeCiudad(' Chamberí ')).toBe('chamberi');
    expect(claveDeCiudad('Málaga')).toBe('malaga');
  });

  it('resuelve alias: CDMX y Ciudad de México son la misma', () => {
    expect(claveDeCiudad('CDMX')).toBe('ciudad de mexico');
    expect(claveDeCiudad('Ciudad de México')).toBe('ciudad de mexico');
  });
});

describe('distritosDeCatalogo', () => {
  it('Madrid trae sus 21 distritos oficiales', () => {
    expect(distritosDeCatalogo('Madrid')).toHaveLength(21);
    expect(distritosDeCatalogo('madrid')).toContain('Chamberí');
  });

  it('una ciudad fuera del catálogo devuelve lista vacía, no revienta', () => {
    expect(distritosDeCatalogo('Cuenca')).toEqual([]);
  });
});

describe('fusionaDistritos', () => {
  it('⭐ el duplicado por grafía se absorbe: «chamberi» del servidor no duplica «Chamberí»', () => {
    const r = fusionaDistritos('Madrid', ['chamberi', 'El Cañaveral']);
    expect(r.filter((d) => claveDeCiudad(d) === 'chamberi')).toEqual(['Chamberí']);
    // Y el barrio no oficial con liga viva SÍ entra, al final.
    expect(r).toContain('El Cañaveral');
    expect(r.indexOf('El Cañaveral')).toBeGreaterThan(r.indexOf('Villaverde'));
  });

  it('en una ciudad sin catálogo, la lista son las ligas vivas ordenadas', () => {
    expect(fusionaDistritos('Cuenca', ['Zocodover', 'Casco'])).toEqual(['Casco', 'Zocodover']);
  });

  it('sin catálogo ni servidor la lista queda vacía y la pantalla usa texto libre', () => {
    expect(fusionaDistritos('Cuenca', [])).toEqual([]);
  });
});

describe('fusionaCiudades', () => {
  it('el catálogo delante y las vivas del servidor detrás, sin duplicar por grafía', () => {
    const r = fusionaCiudades(['madrid', 'Móstoles']);
    expect(r.filter((c) => claveDeCiudad(c) === 'madrid')).toEqual(['Madrid']);
    expect(r).toContain('Móstoles');
    expect(r.indexOf('Móstoles')).toBeGreaterThan(r.indexOf('Zaragoza'));
  });
});

describe('filtraOpciones', () => {
  const madrid = distritosDeCatalogo('Madrid');

  it('con el campo vacío devuelve la lista entera: es el modo hojear', () => {
    expect(filtraOpciones('', madrid)).toHaveLength(21);
    expect(filtraOpciones('   ', madrid)).toHaveLength(21);
  });

  it('filtra letra a letra sin acentos ni mayúsculas', () => {
    expect(filtraOpciones('cha', madrid)).toEqual(['Chamartín', 'Chamberí']);
    expect(filtraOpciones('CHAMBERI', madrid)).toEqual(['Chamberí']);
  });

  it('⭐ empezar cuenta más que contener: «sant» pone los Sant* antes que Sarrià-Sant Gervasi', () => {
    expect(filtraOpciones('sant', distritosDeCatalogo('Barcelona'))).toEqual([
      'Sant Andreu',
      'Sant Martí',
      'Sants-Montjuïc',
      'Sarrià-Sant Gervasi',
    ]);
  });

  it('los alias funcionan: teclear cdmx encuentra Ciudad de México', () => {
    expect(filtraOpciones('cdmx', ['Madrid', 'Ciudad de México'])).toEqual([
      'Ciudad de México',
    ]);
  });

  it('sin coincidencias devuelve vacío, y la pantalla ofrece «Usar…»', () => {
    expect(filtraOpciones('xyz', madrid)).toEqual([]);
  });
});

describe('canonicaliza', () => {
  it('lo tecleado adopta la grafía oficial si coincide por clave', () => {
    expect(canonicaliza('chamberi', distritosDeCatalogo('Madrid'))).toBe('Chamberí');
    expect(canonicaliza('  MADRID ', ['Madrid'])).toBe('Madrid');
  });

  it('sin coincidencia devuelve lo tecleado limpio: la entrada manual vale', () => {
    expect(canonicaliza(' El Cañaveral ', distritosDeCatalogo('Madrid'))).toBe('El Cañaveral');
    expect(canonicaliza('', ['Madrid'])).toBe('');
  });
});

describe('parteCoincidente', () => {
  it('corta la opción original respetando los acentos que la búsqueda ignora', () => {
    expect(parteCoincidente('Chamberí', 'chamberi')).toEqual({
      antes: '',
      medio: 'Chamberí',
      despues: '',
    });
    expect(parteCoincidente('Sants-Montjuïc', 'montju')).toEqual({
      antes: 'Sants-',
      medio: 'Montju',
      despues: 'ïc',
    });
  });

  it('sin aguja o sin coincidencia no hay nada que resaltar', () => {
    expect(parteCoincidente('Chamberí', '')).toBeNull();
    expect(parteCoincidente('Chamberí', 'xyz')).toBeNull();
  });
});
