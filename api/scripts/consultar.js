// Roda um SQL de um arquivo no banco do SantSystem e imprime as linhas.
// Uso: node --env-file=api/.env api/scripts/consultar.js arquivo.sql
import { readFileSync } from 'node:fs';
import { conectar } from '../src/db.js';

const pool = await conectar();
const resultado = await pool.request().query(readFileSync(process.argv[2], 'utf8'));
for (const conjunto of resultado.recordsets) {
  if (process.argv.includes('--json')) console.log(JSON.stringify(conjunto));
  else if (conjunto.length) console.table(conjunto);
}
await pool.close();
