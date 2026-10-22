// Cria (ou atualiza a senha de) um login proprio no SQL Server, com acesso so ao
// banco das OS. Usado pelo instalador do Windows para:
//   app_oficina    -> API (le e grava: db_datareader + db_datawriter)
//   claude_leitura -> Claude no PC da oficina (so le: db_datareader)
// Uso: SA_SENHA=... APP_LOGIN=... APP_SENHA=... [APP_SO_LEITURA=1] node scripts/criar-login.js
import sql from 'mssql';

const login = process.env.APP_LOGIN || 'app_oficina';
const senha = process.env.APP_SENHA;
const soLeitura = process.env.APP_SO_LEITURA === '1';
const banco = process.env.DB_BANCO || 'dadosretorno';
if (!process.env.SA_SENHA || !senha) throw new Error('Informe SA_SENHA e APP_SENHA');
// A senha entra no comando CREATE LOGIN (que nao aceita parametro): so letras e numeros
if (!/^[A-Za-z0-9]{16,}$/.test(senha) || !/^[A-Za-z0-9_]+$/.test(login)) throw new Error('Login ou senha invalidos');

const base = {
  server: process.env.DB_SERVIDOR || 'localhost',
  port: Number(process.env.DB_PORTA || 1433),
  database: banco,
  options: { encrypt: true, trustServerCertificate: true },
};

const sa = await new sql.ConnectionPool({ ...base, user: 'sa', password: process.env.SA_SENHA, pool: { max: 1 } }).connect();
await sa.request().query(`
  IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '${login}')
    CREATE LOGIN [${login}] WITH PASSWORD = '${senha}', DEFAULT_DATABASE = [${banco}], CHECK_POLICY = OFF;
  ELSE
    ALTER LOGIN [${login}] WITH PASSWORD = '${senha}';
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${login}')
    CREATE USER [${login}] FOR LOGIN [${login}];
  ALTER ROLE db_datareader ADD MEMBER [${login}];
  ${soLeitura
    ? `IF IS_ROLEMEMBER('db_datawriter', '${login}') = 1 ALTER ROLE db_datawriter DROP MEMBER [${login}];`
    : `ALTER ROLE db_datawriter ADD MEMBER [${login}];`}`);
await sa.close();

// Confere entrando com o login novo
const app = await new sql.ConnectionPool({ ...base, user: login, password: senha }).connect();
const [{ os }] = (await app.request().query('SELECT COUNT(*) AS os FROM PedVendaCab')).recordset;
await app.close();
console.log(`Login ${login} pronto (${soLeitura ? 'so leitura' : 'leitura e gravacao'}, enxerga ${os} OS no banco ${banco}).`);
