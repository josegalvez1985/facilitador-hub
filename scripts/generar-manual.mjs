// Genera src/facilitadores/manual.ts a partir de docs/manual-usuario.md (el manual
// que se ve en Perfil → Ayuda). Metro no importa .md, por eso se pasa a un string.
// Uso: npm run manual
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(raiz, 'docs', 'manual-usuario.md'), 'utf8')
  .replace(/\r\n/g, '\n')
  // Los comentarios <!-- … --> son notas para quien edita: no van a la app.
  .replace(/<!--[\s\S]*?-->\n?/g, '');

const capitulos = md.split('\n').filter((l) => l.startsWith('## ')).length;
if (!capitulos) throw new Error('docs/manual-usuario.md no tiene capítulos ("## Título")');

const ts = `// GENERADO por scripts/generar-manual.mjs desde docs/manual-usuario.md: no editar a mano.
// Para cambiar el manual, editá el .md y corré \`npm run manual\`.

export const MANUAL = ${JSON.stringify(md)};
`;
writeFileSync(join(raiz, 'src', 'facilitadores', 'manual.ts'), ts);
console.log(`[OK] ${capitulos} capítulos → src/facilitadores/manual.ts`);
