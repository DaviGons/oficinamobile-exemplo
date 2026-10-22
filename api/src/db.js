import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import sql from 'mssql';

// Senha do banco: DB_SENHA (PC da oficina, no .env) ou um arquivo so do usuario
// (notebook: ~/.config/oficinamobile/senha-sa, criado por scripts/salvar-senha.sh)
function senha() {
  if (process.env.DB_SENHA) return process.env.DB_SENHA;
  const candidatos = process.env.DB_SENHA_ARQUIVO
    ? [process.env.DB_SENHA_ARQUIVO]
    : ['~/.config/oficinamobile/senha-sa', '~/.config/santsystem-sa'];
  const arquivo = candidatos.map((c) => c.replace(/^~/, homedir())).find((c) => existsSync(c));
  if (!arquivo) throw new Error('Senha do banco nao encontrada: rode scripts/salvar-senha.sh ou defina DB_SENHA');
  return readFileSync(arquivo, 'utf8').trim();
}

const config = {
  server: process.env.DB_SERVIDOR || '192.168.0.20',
  port: Number(process.env.DB_PORTA || 1433),
  user: process.env.DB_USUARIO || 'sa',
  password: senha(),
  database: process.env.DB_BANCO || 'dadosretorno',
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 10000,
  requestTimeout: 20000,
};

let pool;

export async function conectar() {
  if (!pool) pool = await new sql.ConnectionPool(config).connect();
  return pool;
}

export async function consultar(texto, params = {}) {
  const req = (await conectar()).request();
  for (const [nome, valor] of Object.entries(params)) req.input(nome, valor);
  return (await req.query(texto)).recordset;
}

// Executa fn(req) numa transacao. Com ensaio=true faz tudo e desfaz no fim,
// para testar a gravacao no banco real sem deixar nada gravado.
export async function emTransacao(fn, { ensaio = false } = {}) {
  const tx = new sql.Transaction(await conectar());
  await tx.begin();
  const nova = (params = {}) => {
    const req = new sql.Request(tx);
    for (const [nome, valor] of Object.entries(params)) req.input(nome, valor);
    return req;
  };
  try {
    const resultado = await fn(nova);
    if (ensaio) await tx.rollback();
    else await tx.commit();
    return resultado;
  } catch (erro) {
    try { await tx.rollback(); } catch { /* ja desfeita */ }
    throw erro;
  }
}

export { sql };
