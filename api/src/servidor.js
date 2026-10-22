import { createWriteStream } from 'node:fs';
import { format } from 'node:util';
import express from 'express';
import { conectar } from './db.js';
import { rotas } from './rotas.js';

// No Windows a API roda como tarefa agendada, sem terminal: grava o log em arquivo
if (process.env.LOG_ARQUIVO) {
  const log = createWriteStream(process.env.LOG_ARQUIVO, { flags: 'a' });
  const gravar = (...args) => log.write(`${new Date().toISOString()} ${format(...args)}\n`);
  console.log = gravar;
  console.error = gravar;
}

const PORTA = Number(process.env.PORTA || 3333);
const TOKEN = process.env.APP_TOKEN;

if (!TOKEN) {
  console.error('Defina APP_TOKEN no arquivo .env (o app manda esse codigo em cada pedido).');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.get('x-token') !== TOKEN) return res.status(401).json({ erro: 'Código de acesso inválido' });
  next();
});

app.use(rotas());

app.use((erro, req, res, _next) => {
  const status = erro.status || 500;
  if (status >= 500) console.error(new Date().toISOString(), req.method, req.originalUrl, erro);
  res.status(status).json({
    erro: status >= 500 ? `Erro no servidor: ${erro.message}` : erro.message,
    // Erros que o app trata (ex.: modelo_novo -> oferece cadastrar o modelo)
    ...(erro.codigo ? { codigo: erro.codigo, ...erro.dados } : {}),
  });
});

// Sobe mesmo sem o banco (ex.: notebook fora da oficina); cada pedido tenta conectar de novo
conectar().catch((erro) => console.error('Banco indisponível por enquanto:', erro.message));
app.listen(PORTA, '0.0.0.0', () => console.log(`API do SantSystem na porta ${PORTA}`));
