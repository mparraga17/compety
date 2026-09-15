import { codigoDeUrl, enlaceDeLiga } from './enlaces';

describe('enlaces de invitación', () => {
  test('el enlace lleva el código en mayúsculas en la query', () => {
    expect(enlaceDeLiga('abc123')).toBe(
      'https://mparraga17.github.io/compety/liga.html?codigo=ABC123',
    );
  });

  test('el nombre de la liga viaja en el enlace, codificado', () => {
    expect(enlaceDeLiga('ABC123', 'Los del jueves')).toBe(
      'https://mparraga17.github.io/compety/liga.html?codigo=ABC123&liga=Los%20del%20jueves',
    );
    // Y el parser sigue sacando el código aunque haya más parámetros detrás.
    expect(codigoDeUrl(enlaceDeLiga('ABC123', 'Los del jueves'))).toBe('ABC123');
  });

  test('saca el código del esquema propio', () => {
    expect(codigoDeUrl('compety://liga/ABC123')).toBe('ABC123');
    // En minúsculas también: el código viaja escrito por humanos.
    expect(codigoDeUrl('compety://liga/abc123')).toBe('ABC123');
    // Con restos detrás no se rompe.
    expect(codigoDeUrl('compety://liga/ABC123?desde=whatsapp')).toBe('ABC123');
  });

  test('saca el código de la página de invitación', () => {
    expect(codigoDeUrl('https://mparraga17.github.io/compety/liga.html?codigo=XY99ZZ')).toBe(
      'XY99ZZ',
    );
    // Aunque el código no sea el primer parámetro.
    expect(
      codigoDeUrl('https://mparraga17.github.io/compety/liga.html?desde=web&codigo=XY99ZZ'),
    ).toBe('XY99ZZ');
  });

  test('lo que no es una invitación devuelve null', () => {
    // La URL del dev client, que el listener recibe en cada arranque de desarrollo.
    expect(
      codigoDeUrl('exp+compety://expo-development-client/?url=http%3A%2F%2F192.168.1.144%3A8081'),
    ).toBeNull();
    // Un https cualquiera con un parámetro codigo no es nuestra página.
    expect(codigoDeUrl('https://malicioso.com/liga.html?codigo=ABC123')).toBeNull();
    // Rutas del esquema que no son la de liga.
    expect(codigoDeUrl('compety://otra/ABC123')).toBeNull();
  });

  test('un código con formato inválido devuelve null, nunca un código a medias', () => {
    expect(codigoDeUrl('compety://liga/ABC12')).toBeNull(); // 5 caracteres
    expect(codigoDeUrl('compety://liga/ABC1234')).toBeNull(); // 7
    expect(codigoDeUrl('compety://liga/AB%20123')).toBeNull(); // espacio dentro
    expect(codigoDeUrl('https://mparraga17.github.io/compety/liga.html?codigo=')).toBeNull();
  });

  test('percent-encoding roto devuelve null en vez de lanzar', () => {
    // `decodeURIComponent` lanza URIError con estas tres. El listener de enlaces es síncrono:
    // sin la guarda, un enlace corrupto compartido por WhatsApp era un crash de la app entera.
    expect(codigoDeUrl('compety://liga/%')).toBeNull();
    expect(codigoDeUrl('compety://liga/%ZZ123')).toBeNull();
    expect(
      codigoDeUrl('https://mparraga17.github.io/compety/liga.html?codigo=%E0%A4%A'),
    ).toBeNull();
  });
});
