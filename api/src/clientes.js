// Cadastro de clientes, repetindo o SantSystem (cliente 5937, 07/10/2026 16:01):
// INSERT em Cadastros -> ICCS/CHVCAD1 = id -> CadExt por PC (Sit 'P') ->
// Registra_Movimento -> Env_Web 'P' + copia XML do cadastro em Cadastro_Xml.
import { consultar, emTransacao } from './db.js';
import {
  cep, dataNumero, dataTexto, horaFracao, horaTexto, identificador, nascimento, soDigitos, telefone, texto,
} from './formato.js';

// O app grava pelo PC servidor: o token dele vai no CadExt (como o PC que cadastra)
const PC = 'SERVIDOR-OFICINA';
const TELA = 'AppOficina';

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

// Campos que o app edita -> colunas do Cadastros
function camposDoCorpo(b) {
  const tipo = b.tipo === 'J' ? 'J' : 'F';
  const nome = texto(b.nome, 150).toUpperCase();
  const uf = texto(b.uf, 2).toUpperCase();
  return {
    TipFisJur: tipo,
    nom: nome,
    apdoftsia: texto(b.apelido, 150).toUpperCase() || nome,
    CPF: soDigitos(b.documento).slice(0, 14),
    RG: texto(b.rg, 25),
    nasc: nascimento(b.nascimento),
    observaçoes: texto(b.obs, 2000),
    TipEnd: texto(b.tipoEndereco, 30),
    Ende: texto(b.endereco, 150),
    Num: texto(b.numero, 20),
    Compl: texto(b.complemento, 60),
    Bairro: texto(b.bairro, 60),
    Cidade: texto(b.cidade, 50),
    UF: UFS.has(uf) ? uf : '',
    Cep: cep(b.cep),
    CodCid: soDigitos(b.codigoCidade).slice(0, 7),
    Fone1: telefone(b.telefone),
    Cel: telefone(b.celular),
    Email: texto(b.email, 120).toLowerCase(),
  };
}

function validar(c) {
  if (c.nom.length < 2) return 'Informe o nome';
  if (c.CPF && c.TipFisJur === 'F' && c.CPF.length !== 11) return 'CPF deve ter 11 números';
  if (c.CPF && c.TipFisJur === 'J' && c.CPF.length !== 14) return 'CNPJ deve ter 14 números';
  return null;
}

// Copia XML do cadastro: colunas na ordem da tabela, sem as nulas,
// vazio vira quebra de linha (mesmo formato gravado pelo SantSystem)
function xmlDoCadastro(linha, colunas) {
  const partes = ['<?xml version="1.0"?>', '<Cadastro_Completo>', '<Cadastro>'];
  for (const col of colunas) {
    let v = linha[col.name];
    if (v === null || v === undefined) continue;
    if (col.type?.name === 'Money') v = Number(v).toFixed(4);
    v = String(v).replace(/[<>]/g, '');
    partes.push(`<${col.name}>${v === '' ? '\r\n' : v}</${col.name}>`);
  }
  partes.push('</Cadastro>', '</Cadastro_Completo>');
  return partes.join('\r\n');
}

// Log sem usuario: "quem fez" fica sempre em branco
async function registrar(nova, id, tipo, cadExtNovo) {
  const [servidor] = (await nova({ pc: PC }).query('SELECT Token_PC FROM CompuExt WHERE Compu = @pc')).recordset;
  const token = servidor?.Token_PC ?? '';

  // Avisa cada PC para atualizar a lista de clientes
  const pcs = (await nova().query("SELECT Id, Compu FROM CompuExt WHERE Compu IS NOT NULL AND Compu <> ''")).recordset;
  for (const pc of pcs) {
    const params = { compu: String(pc.Id), cad: String(id), nome: pc.Compu, token };
    if (cadExtNovo) {
      await nova(params).query(`INSERT INTO CadExt (ChvCompu, ChvCad, Sit, NomePc, Token_PC)
        VALUES (@compu, @cad, 'P', @nome, @token)`);
    } else {
      const r = await nova(params).query(`UPDATE CadExt SET Sit = 'P', NomePc = @nome, Token_PC = @token
        WHERE ChvCompu = @compu AND ChvCad = @cad`);
      if (!r.rowsAffected[0]) {
        await nova(params).query(`INSERT INTO CadExt (ChvCompu, ChvCad, Sit, NomePc, Token_PC)
          VALUES (@compu, @cad, 'P', @nome, @token)`);
      }
    }
  }

  await nova({
    data: dataTexto(), hora: horaTexto(), pc: PC, usu: '', nome: '', tipo, tela: TELA, id: String(id),
  }).query(`INSERT INTO Registra_Movimento (Data, Hora, Computador, Usuario, Nome_Usuario, Tipo, Tela, Identificacao_Registro)
    VALUES (@data, @hora, @pc, @usu, @nome, @tipo, @tela, @id)`);

  await nova({ id }).query("UPDATE Cadastros SET Cadastro_Xml = '' WHERE ICCS = @id");
  const r = await nova({ id }).query('SELECT * FROM Cadastros WHERE ICCS = @id');
  const colunas = Object.values(r.recordset.columns).sort((a, b) => a.index - b.index);
  await nova({ id, xml: xmlDoCadastro(r.recordset[0], colunas) }).query(
    "UPDATE Cadastros SET Env_Web = 'P', Cadastro_Xml = @xml WHERE ICCS = @id");
}

function clienteDaLinha(c) {
  return {
    id: c.ChvCadastros,
    tipo: c.TipFisJur === 'J' ? 'J' : 'F',
    nome: c.nom ?? '',
    apelido: c.apdoftsia ?? '',
    documento: c.CPF ?? '',
    rg: c.RG ?? '',
    nascimento: c.nasc === '01/01/1900' ? '' : (c.nasc ?? ''),
    celular: c.Cel ?? '',
    telefone: c.Fone1 ?? '',
    email: c.Email ?? '',
    cep: c.Cep === '00000000' ? '' : (c.Cep ?? ''),
    tipoEndereco: c.TipEnd ?? '',
    endereco: c.Ende ?? '',
    numero: c.Num ?? '',
    complemento: c.Compl ?? '',
    bairro: c.Bairro ?? '',
    cidade: c.Cidade ?? '',
    uf: c.UF ?? '',
    codigoCidade: c.CodCid ?? '',
    obs: c.observaçoes ?? '',
  };
}

export function rotasClientes(r, { ensaio, ErroDeUso }) {
  r.get('/clientes', async (req, res) => {
    const busca = texto(req.query.busca, 60);
    if (busca.length < 2) return res.json([]);
    const digitos = soDigitos(busca);
    const linhas = await consultar(`SELECT TOP 30 ChvCadastros AS id, nom AS nome, apdoftsia AS fantasia,
        CPF AS documento, Cel AS celular, Fone1 AS telefone, Cidade AS cidade, UF AS uf
      FROM Cadastros
      WHERE Descr = 'Clientes' AND ISNULL(Excluido, 0) <> 1
        AND (nom COLLATE Latin1_General_CI_AI LIKE @like OR apdoftsia COLLATE Latin1_General_CI_AI LIKE @like
          OR (LEN(@dig) >= 4 AND (CPF LIKE @digLike
            OR REPLACE(REPLACE(REPLACE(REPLACE(Cel, '(', ''), ')', ''), '-', ''), ' ', '') LIKE @digLike
            OR REPLACE(REPLACE(REPLACE(REPLACE(Fone1, '(', ''), ')', ''), '-', ''), ' ', '') LIKE @digLike)))
      ORDER BY nom`, { like: `%${busca}%`, dig: digitos, digLike: `%${digitos}%` });
    res.json(linhas);
  });

  r.get('/clientes/:id', async (req, res) => {
    const [c] = await consultar(`SELECT * FROM Cadastros WHERE ChvCadastros = @id AND Descr = 'Clientes'`,
      { id: Number(req.params.id) });
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(clienteDaLinha(c));
  });

  r.post('/clientes', async (req, res) => {
    const b = req.body ?? {};
    const c = camposDoCorpo(b);
    const problema = validar(c);
    if (problema) throw new ErroDeUso(problema);
    const pre = await prefixo();
    const resultado = await emTransacao(async (nova) => {
      if (c.CPF) {
        const [dup] = (await nova({ doc: c.CPF }).query(
          "SELECT TOP 1 ChvCadastros, nom FROM Cadastros WHERE CPF = @doc AND Descr = 'Clientes' AND ISNULL(Excluido, 0) <> 1")).recordset;
        if (dup) throw new ErroDeUso(`Já existe cliente com esse documento: ${dup.nom} (${dup.ChvCadastros})`, 409);
      }
      const valores = {
        Fiscal: '0', Caixa: '0', ...c, Cod: '1', datCad: dataTexto(), DDD1: undefined,
        Fone2: '', Cracha: '', Bloquear: '0', ObConv: '.', Site: '', VC: '0', Haver: '0,00', Aparece: '0',
        SitRet: '0', Descr: 'Clientes', VLCOMIS: '0,00', CHVCAD1: '', CEP1: '', TipEnd1: '', Ende1: '', Num1: '',
        Bairro1: '', Cidade1: '', UF1: '', CEP2: '', TipEnd2: '', Ende2: '', Num2: '', Bairro2: '', Cidade2: '',
        UF2: '', EndNFe: '1', CRT: '1', PRCUTIL: '1', TipCons: 'Cons', EmpVinc: '0', EmailN: '', AUTDES: '0',
        CodCid1: '', CodCid2: '', CKAviso: '0', DtAlt: dataNumero(), HoraAlt: horaFracao(), VLDelivery: '0,00',
        Guid: identificador(pre), CKDV: '0', TXTDV: '01', numero_suframa: '', CFCP: '1', ERepresentante: '0',
        SeqCad: '', CadParRota: '0', Rota: '0', Compl1: '', Compl2: '', Pais: 'Brasil', Pais1: 'Brasil',
        Pais2: 'Brasil', CodPais: '1058', CodPais1: '1058', CodPais2: '1058', Identificador: identificador(pre),
        Cel2: '', EmailCotacao: '', USUARIO_INTERMEDIADOR: '',
      };
      delete valores.DDD1;
      const colunas = Object.keys(valores);
      const params = Object.fromEntries(colunas.map((k, i) => [`p${i}`, valores[k]]));
      const [novo] = (await nova(params).query(`INSERT INTO Cadastros (${colunas.map((k) => `[${k}]`).join(', ')},
          LimiteCredito, Excluido, Intermediador)
        OUTPUT INSERTED.ChvCadastros
        VALUES (${colunas.map((_, i) => `@p${i}`).join(', ')}, 0, 0, 0)`)).recordset;
      const id = novo.ChvCadastros;
      await nova({ id }).query('UPDATE Cadastros SET ICCS = @id WHERE ChvCadastros = @id');
      await nova({ id: String(id), n: id }).query('UPDATE Cadastros SET CHVCAD1 = @id, NumCli = @id WHERE ICCS = @n');
      await registrar(nova, id, 'Insert', true);
      const previa = ensaio(req)
        ? (await nova({ id }).query('SELECT * FROM Cadastros WHERE ChvCadastros = @id')).recordset[0]
        : undefined;
      return { id, previa };
    }, { ensaio: ensaio(req) });
    res.status(201).json({ ...resultado, ensaio: ensaio(req) });
  });

  r.patch('/clientes/:id', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const c = camposDoCorpo(b);
    const problema = validar(c);
    if (problema) throw new ErroDeUso(problema);
    const previa = await emTransacao(async (nova) => {
      const [atual] = (await nova({ id }).query(
        "SELECT ChvCadastros FROM Cadastros WHERE ChvCadastros = @id AND Descr = 'Clientes'")).recordset;
      if (!atual) throw new ErroDeUso('Cliente não encontrado', 404);
      const valores = { ...c, DtAlt: dataNumero(), HoraAlt: horaFracao() };
      const colunas = Object.keys(valores);
      const params = Object.fromEntries(colunas.map((k, i) => [`p${i}`, valores[k]]));
      await nova({ ...params, id }).query(
        `UPDATE Cadastros SET ${colunas.map((k, i) => `[${k}] = @p${i}`).join(', ')} WHERE ChvCadastros = @id`);
      await registrar(nova, id, 'Update', false);
      return ensaio(req)
        ? (await nova({ id }).query('SELECT * FROM Cadastros WHERE ChvCadastros = @id')).recordset[0]
        : undefined;
    }, { ensaio: ensaio(req) });
    res.json({ ok: true, ensaio: ensaio(req), previa });
  });
}

let prefixoId;
async function prefixo() {
  if (!prefixoId) {
    const [linha] = await consultar("SELECT cp5 FROM ConfigSis WHERE Busca = 'VERSAO'");
    prefixoId = String(linha?.cp5 ?? '').trim() || '22880';
  }
  return prefixoId;
}
