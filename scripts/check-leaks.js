/**
 * Guard against leaking the private engine into this public repo.
 *
 * Fails if any tracked text file contains a marker that only exists in the private engine.
 * Run it before every push: `npm run check:leaks`.
 */
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

// Names and markers that belong to the private engine. Kept generic on purpose.
const FORBIDDEN = [
  /src[\\/]motor/i,
  /K_VOLUMEN/,
  /cargaSinFc|factorModalidad|puntosDeCarga|DESCUENTO\./,
  /minut(e|o)s?\s*\*\*\s*[A-Z_]/,
];

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx|js|json|md|sql|html)$/.test(f) && f !== 'scripts/check-leaks.js');

const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
  }
}

if (hits.length > 0) {
  console.error('Possible private engine content found:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`OK: ${files.length} files checked, no private engine content.`);
