// Genera src/facilitadores/frases.ts a partir de docs/frases-docentes.md (una frase
// numerada por línea: "1. …"). Uso: npm run frases
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(raiz, 'docs', 'frases-docentes.md'), 'utf8');
const frases = md
  .split(/\r?\n/)
  .map((l) => /^\d+\.\s+(.+?)\s*$/.exec(l)?.[1])
  .filter(Boolean);

if (!frases.length) throw new Error('No se encontraron frases numeradas en docs/frases-docentes.md');

const ts = `// GENERADO por scripts/generar-frases.mjs desde docs/frases-docentes.md: no editar a mano.
// Para cambiar las frases, editá el .md y corré \`npm run frases\`.

export const FRASES: readonly string[] = ${JSON.stringify(frases, null, 2)};
`;
writeFileSync(join(raiz, 'src', 'facilitadores', 'frases.ts'), ts);
console.log(`[OK] ${frases.length} frases → src/facilitadores/frases.ts`);
