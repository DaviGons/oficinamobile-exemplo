// Rotas da API. As gravacoes repetem o que o SantSystem faz
// ("quem fez" fica sempre em branco: ChvFunc da OS e Id_Funcionario do servico)
// (ver docs/RECEITAS.md, capturado em 07/10/2026).
import { Router } from 'express';
import { rotasClientes } from './clientes.js';
import { consultar, emTransacao, sql } from './db.js';
import {
  dataDeNumero, dataNumero, dinheiro, identificador, lerNumero, percentual, placa, placaAlternativa, quantidade, texto,
} from './formato.js';
import { cadastrarModelo, marcas, modelos, resolverVeiculo, veiculoSugerido } from './veiculos.js';

const DADOS_ADICIONAIS = 'Empresa optante pelo simples não da direito a crédito ICMS IPI.        ';

let prefixoId;
async function prefixo() {
  if (!prefixoId) {
    const [linha] = await consultar("SELECT cp5 FROM ConfigSis WHERE Busca = 'VERSAO'");
    prefixoId = String(linha?.cp5 ?? '').trim() || '22880';
  }
  return prefixoId;
}

const ensaio = (req) => req.query.ensaio === '1';

class ErroDeUso extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

function osDaLinha(c) {
  return {
    id: c.Id,
    clienteId: Number(c.ChvCad),
    cliente: c.cliente ?? null,
    funcionarioId: Number(c.ChvFunc) || null,
    placa: c.PlacaVei === '___-____' ? '' : c.PlacaVei,
    marca: c.Marca, modelo: c.Modelo, ano: c.Ano_Veiculo, cor: c.Cor, km: c.KM,
    obs: c.OBS,
    abertura: dataDeNumero(c.DtPed),
    fim: dataDeNumero(c.Dtfim),
    finalizada: c.Final === '1',
    excluida: c.Excluido === '1',
    totalPecas: lerNumero(c.TotalPed),
    totalServicos: lerNumero(c.Vl_LQ_Serv),
    total: lerNumero(c.TxtTotGer),
  };
}

const COLUNAS_LISTA = `c.Id, c.ChvCad, c.ChvFunc, c.PlacaVei, c.Marca, c.Modelo, c.Ano_Veiculo, c.Cor, c.KM, c.OBS,
  c.DtPed, c.Dtfim, c.Final, c.Excluido, c.TotalPed, c.Vl_LQ_Serv, c.TxtTotGer, cad.nom AS cliente`;

// Recalcula os totais do cabecalho a partir das pecas e servicos (igual ao SantSystem)
async function recalcular(nova, osId) {
  const pecas = (await nova({ os: String(osId) }).query(
    "SELECT SubTotPed, Custo FROM PedVendaProd WHERE ChvPed = @os AND Excluido = '0'")).recordset;
  const servicos = (await nova({ os: String(osId) }).query(
    "SELECT SubTot, Custo FROM Servicos_OS WHERE Id_Venda = @os AND ISNULL(Sit, 'N') <> 'EX'")).recordset;
  const [cab] = (await nova({ id: osId }).query('SELECT Vl_Desc_Serv FROM PedVendaCab WHERE Id = @id')).recordset;

  const soma = (linhas, campo) => linhas.reduce((t, l) => t + lerNumero(l[campo]), 0);
  const totPecas = soma(pecas, 'SubTotPed');
  const brServ = soma(servicos, 'SubTot');
  const lqServ = brServ - lerNumero(cab?.Vl_Desc_Serv);

  await nova({
    id: osId,
    totItens: dinheiro(totPecas),
    cusItens: dinheiro(soma(pecas, 'Custo')),
    brServ: dinheiro(brServ),
    lqServ: dinheiro(lqServ),
    cusServ: dinheiro(soma(servicos, 'Custo')),
    totGer: dinheiro(totPecas + lqServ),
  }).query(`UPDATE PedVendaCab SET TotItens = @totItens, TotalPed = @totItens, TotCusItens = @cusItens,
      Vl_Br_Serv = @brServ, Vl_LQ_Serv = @lqServ, TotCusServ = @cusServ, TxtTotGer = @totGer
    WHERE Id = @id`);
}

async function osEditavel(nova, osId) {
  const [c] = (await nova({ id: osId }).query(
    'SELECT Id, ChvCad, Final, Excluido FROM PedVendaCab WHERE Id = @id')).recordset;
  if (!c) throw new ErroDeUso('OS não encontrada', 404);
  if (c.Excluido === '1') throw new ErroDeUso('OS excluída', 409);
  if (c.Final === '1') throw new ErroDeUso('OS já finalizada', 409);
  return c;
}

// CFOP/CST: repete o ultimo usado pelo SantSystem para o cliente; sem historico,
// usa a regra do item (dentro do estado) ou 6404 para cliente fora de SP.
// Dentro de SP o SantSystem usa o CFOP do cadastro e CSOSN 102 para regra B (tributado), 500 para as
// outras (A substituicao, E outros) — o MRegra nao muda quando a regra do item e trocada (19/10/2026)
async function fiscal(nova, clienteId, item) {
  const regra = String(item.MRegra ?? '').split('|');
  const dentro = {
    cfop: String(item.CFOP || regra[1] || '5405').trim(),
    cst: String(item.RDE ?? '').trim().toUpperCase() === 'B' ? '102' : '500',
  };
  const [ultimo] = (await nova({ c: String(clienteId) }).query(
    'SELECT TOP 1 CFOP FROM PedVendaProd WHERE ChvCad = @c ORDER BY Id DESC')).recordset;
  if (ultimo) return String(ultimo.CFOP).startsWith('6') ? { cfop: '6404', cst: '' } : dentro;
  const [cli] = (await nova({ c: clienteId }).query(
    'SELECT UF FROM Cadastros WHERE ChvCadastros = @c')).recordset;
  return String(cli?.UF ?? '').trim().toUpperCase() === 'SP' ? dentro : { cfop: '6404', cst: '' };
}

// No modo ensaio, le de dentro da transacao como as linhas ficariam gravadas
async function previa(nova, osId, extra = {}) {
  const ler = async (consulta, params) => (await nova(params).query(consulta)).recordset;
  const r = {
    cabecalho: (await ler('SELECT * FROM PedVendaCab WHERE Id = @id', { id: osId }))[0],
  };
  if (extra.pecaId) r.peca = (await ler('SELECT * FROM PedVendaProd WHERE Id = @id', { id: extra.pecaId }))[0];
  if (extra.servicoId) r.servico = (await ler('SELECT * FROM Servicos_OS WHERE Id = @id', { id: extra.servicoId }))[0];
  return r;
}

export function rotas() {
  const r = Router();

  r.get('/saude', async (_req, res) => {
    const [l] = await consultar('SELECT @@SERVERNAME AS servidor, DB_NAME() AS banco');
    res.json({ ok: true, ...l });
  });

  r.get('/funcionarios', async (_req, res) => {
    const linhas = await consultar(`SELECT ChvCadastros AS id, nom AS nome FROM Cadastros
      WHERE Descr = 'Funcionarios' AND ISNULL(Excluido, 0) <> 1 ORDER BY nom`);
    res.json(linhas);
  });

  rotasClientes(r, { ensaio, ErroDeUso });

  // Veiculos ja atendidos do cliente, para preencher a OS nova
  r.get('/clientes/:id/veiculos', async (req, res) => {
    const linhas = await consultar(`SELECT TOP 10 PlacaVei, Marca, Modelo, Ano_Veiculo, Cor, KM, Id
      FROM PedVendaCab c
      WHERE ChvCad = @c AND Excluido = '0' AND PlacaVei <> '___-____'
        AND Id = (SELECT MAX(Id) FROM PedVendaCab x WHERE x.ChvCad = c.ChvCad AND x.PlacaVei = c.PlacaVei)
      ORDER BY Id DESC`, { c: String(req.params.id) });
    res.json(await Promise.all(linhas.map(async (l) => ({
      placa: l.PlacaVei, ...(await veiculoSugerido(l.Marca, l.Modelo)), ano: l.Ano_Veiculo, cor: l.Cor, km: l.KM,
    }))));
  });

  // Listas de marca/modelo do SantSystem (antes de /veiculos/:placa, que pegaria "marcas")
  r.get('/veiculos/marcas', async (_req, res) => {
    res.json(await marcas());
  });

  r.get('/veiculos/marcas/:id/modelos', async (req, res) => {
    res.json(await modelos(Number(req.params.id)));
  });

  // Modelo que ainda nao existe na marca: cadastra na lista do SantSystem
  r.post('/veiculos/modelos', async (req, res) => {
    const b = req.body ?? {};
    const r2 = await emTransacao((nova) => cadastrarModelo(nova, b.marca, b.modelo), { ensaio: ensaio(req) });
    res.status(r2.novo ? 201 : 200).json({ ...r2, ensaio: ensaio(req) });
  });

  // Busca pela placa (formato antigo ou Mercosul): dados do carro da ultima OS e os
  // clientes que ja trouxeram esse carro, do mais recente para o mais antigo
  r.get('/veiculos/:placa', async (req, res) => {
    const so = String(req.params.placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (so.length < 7) return res.json({ veiculo: null, clientes: [] });
    const alt = placaAlternativa(so) ?? so;
    const linhas = await consultar(`SELECT c.Id, c.ChvCad, c.PlacaVei, c.Marca, c.Modelo, c.Ano_Veiculo, c.Cor, c.DtPed,
        cad.nom AS cliente
      FROM PedVendaCab c
      LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
      WHERE c.Origem = 'O.S' AND c.Excluido = '0' AND REPLACE(c.PlacaVei, '-', '') IN (@so, @alt)
      ORDER BY c.Id DESC`, { so, alt });
    if (!linhas.length) return res.json({ veiculo: null, clientes: [] });
    const ultima = linhas[0];
    const clientes = [];
    for (const l of linhas) {
      const id = Number(l.ChvCad) || 0;
      if (!id || !l.cliente || clientes.some((c) => c.id === id)) continue;
      clientes.push({ id, nome: l.cliente, ultimaOS: l.Id, data: dataDeNumero(l.DtPed) });
    }
    // Placa so muda do formato antigo para o Mercosul: se alguma das duas e Mercosul, e a atual
    const ehMercosul = (p) => /^[A-Z]{3}[0-9][A-J][0-9]{2}$/.test(p);
    const formas = [so, ...linhas.map((l) => l.PlacaVei.replace('-', ''))];
    const atual = formas.find(ehMercosul) ?? so;
    const outra = formas.find((p) => p !== atual) ?? null;
    res.json({
      veiculo: {
        placa: placa(atual), ...(await veiculoSugerido(ultima.Marca, ultima.Modelo)), ano: ultima.Ano_Veiculo, cor: ultima.Cor,
        placaAnterior: outra ? placa(outra) : null, atendimentos: linhas.length,
      },
      clientes,
    });
  });

  r.get('/os', async (req, res) => {
    const busca = texto(req.query.busca, 40);
    const situacao = req.query.situacao === 'finalizadas' ? '1' : '0';
    const so = busca.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const linhas = await consultar(`SELECT TOP 300 ${COLUNAS_LISTA}
      FROM PedVendaCab c
      LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
      WHERE c.Origem = 'O.S' AND c.Excluido = '0' AND c.Final = @final
        AND (@busca = '' OR CAST(c.Id AS varchar(20)) = @busca OR cad.nom COLLATE Latin1_General_CI_AI LIKE @like
             OR (@so <> '' AND REPLACE(c.PlacaVei, '-', '') LIKE @placa))
      ORDER BY c.Id DESC`,
    { final: situacao, busca, like: `%${busca}%`, so, placa: `%${so}%` });
    res.json(linhas.map(osDaLinha));
  });

  r.get('/os/:id', async (req, res) => {
    const id = Number(req.params.id);
    const [c] = await consultar(`SELECT ${COLUNAS_LISTA} FROM PedVendaCab c
      LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int) WHERE c.Id = @id`, { id });
    if (!c) return res.status(404).json({ erro: 'OS não encontrada' });
    const pecas = await consultar(`SELECT Id, Nitem, Cod, Descr, QtdPed, VlUnitBr, SubTotPed, Custo, UnMed, Baixado
      FROM PedVendaProd WHERE ChvPed = @os AND Excluido = '0' ORDER BY TRY_CAST(Nitem AS int)`, { os: String(id) });
    const servicos = await consultar(`SELECT Id, Codigo, Descr, Quant, VlUnit, SubTot, Custo, Id_Funcionario
      FROM Servicos_OS WHERE Id_Venda = @os AND ISNULL(Sit, 'N') <> 'EX' ORDER BY Id`, { os: String(id) });
    res.json({
      ...osDaLinha(c),
      pecas: pecas.map((p) => ({
        id: p.Id, item: Number(p.Nitem), codigo: p.Cod, descricao: p.Descr, unidade: p.UnMed,
        quantidade: lerNumero(p.QtdPed), valorUnitario: lerNumero(p.VlUnitBr), subtotal: lerNumero(p.SubTotPed),
        custo: lerNumero(p.Custo), baixada: p.Baixado === 'Sim',
      })),
      servicos: servicos.map((s) => ({
        id: s.Id, codigo: s.Codigo, descricao: s.Descr, quantidade: lerNumero(s.Quant),
        valorUnitario: lerNumero(s.VlUnit), subtotal: lerNumero(s.SubTot), custo: lerNumero(s.Custo),
        funcionarioId: Number(s.Id_Funcionario) || null,
      })),
    });
  });

  // Dados para o PDF entregue ao cliente. Por regra NAO saem daqui: observacoes
  // (da OS, dos servicos e do cliente) e custos — so o que pode ir para o papel.
  r.get('/os/:id/impressao', async (req, res) => {
    const id = Number(req.params.id);
    const [c] = await consultar(`SELECT Id, ChvCad, PlacaVei, Marca, Modelo, Ano_Veiculo, Cor, KM, DtPed, Dtfim, Final,
        Excluido, TotalPed, Vl_Br_Serv, Vl_Desc_Serv, Vl_LQ_Serv, TxtTotGer
      FROM PedVendaCab WHERE Id = @id`, { id });
    if (!c) return res.status(404).json({ erro: 'OS não encontrada' });
    const [empresa] = await consultar(`SELECT TOP 1 RSocial, NFantasia, CNPJ, Inscr, Rua, Num, Bairro, Cidade, UF, Cep,
        Telefone, Email FROM Empresa ORDER BY Id`);
    const [cli] = Number(c.ChvCad) ? await consultar(`SELECT ChvCadastros, TipFisJur, nom, CPF, TipEnd, Ende, Num, Compl,
        Bairro, Cidade, UF, Cep, Cel, Fone1, Email FROM Cadastros WHERE ChvCadastros = @c`, { c: Number(c.ChvCad) }) : [];
    const pecas = await consultar(`SELECT Cod, Descr, UnMed, QtdPed, VlUnitBr, SubTotPed FROM PedVendaProd
      WHERE ChvPed = @os AND Excluido = '0' ORDER BY TRY_CAST(Nitem AS int)`, { os: String(id) });
    const servicos = await consultar(`SELECT Descr, Quant, VlUnit, SubTot FROM Servicos_OS
      WHERE Id_Venda = @os AND ISNULL(Sit, 'N') <> 'EX' ORDER BY Id`, { os: String(id) });
    const t = (v) => String(v ?? '').trim();
    res.json({
      empresa: empresa ? {
        nome: t(empresa.NFantasia) || t(empresa.RSocial), razaoSocial: t(empresa.RSocial), cnpj: t(empresa.CNPJ),
        ie: t(empresa.Inscr), endereco: [t(empresa.Rua), t(empresa.Num)].filter(Boolean).join(', '),
        bairro: t(empresa.Bairro), cidade: t(empresa.Cidade), uf: t(empresa.UF), cep: t(empresa.Cep),
        telefone: t(empresa.Telefone), email: t(empresa.Email),
      } : null,
      cliente: cli ? {
        codigo: cli.ChvCadastros, nome: t(cli.nom), tipo: cli.TipFisJur === 'J' ? 'J' : 'F', documento: t(cli.CPF),
        endereco: [[t(cli.TipEnd), t(cli.Ende)].filter(Boolean).join(' '), t(cli.Num), t(cli.Compl)].filter(Boolean).join(', '),
        bairro: t(cli.Bairro), cidade: t(cli.Cidade), uf: t(cli.UF), cep: t(cli.Cep) === '00000000' ? '' : t(cli.Cep),
        celular: t(cli.Cel), telefone: t(cli.Fone1), email: t(cli.Email),
      } : null,
      os: {
        id: c.Id, abertura: dataDeNumero(c.DtPed), fim: dataDeNumero(c.Dtfim), finalizada: c.Final === '1',
        excluida: c.Excluido === '1', placa: c.PlacaVei === '___-____' ? '' : t(c.PlacaVei), marca: t(c.Marca),
        modelo: t(c.Modelo), ano: t(c.Ano_Veiculo), cor: t(c.Cor), km: t(c.KM),
      },
      pecas: pecas.map((p) => ({
        codigo: t(p.Cod), descricao: t(p.Descr), unidade: t(p.UnMed), quantidade: lerNumero(p.QtdPed),
        valorUnitario: lerNumero(p.VlUnitBr), subtotal: lerNumero(p.SubTotPed),
      })),
      servicos: servicos.map((s) => ({
        descricao: t(s.Descr), quantidade: lerNumero(s.Quant), valorUnitario: lerNumero(s.VlUnit),
        subtotal: lerNumero(s.SubTot),
      })),
      totais: {
        pecas: lerNumero(c.TotalPed), servicos: lerNumero(c.Vl_Br_Serv), descontoServicos: lerNumero(c.Vl_Desc_Serv),
        total: lerNumero(c.TxtTotGer),
      },
    });
  });

  r.get('/pecas', async (req, res) => {
    const busca = texto(req.query.busca, 60);
    if (!busca) return res.json([]);
    // Tambem acha pelos codigos da tabela codigos (ex.: oc1225), como o SantSystem
    const linhas = await consultar(`SELECT TOP 40 ICPS, Cod, Descr, PrecVen, Custo, UNMED, Estoque
      FROM Itens WHERE Cod = @busca OR Cod LIKE @inicio OR Descr COLLATE Latin1_General_CI_AI LIKE @like
        OR ICPS IN (SELECT TRY_CAST(ChvProd AS int) FROM codigos WHERE Cod = @busca)
      ORDER BY CASE WHEN Cod = @busca OR ICPS IN (SELECT TRY_CAST(ChvProd AS int) FROM codigos WHERE Cod = @busca)
        THEN 0 ELSE 1 END, Descr`,
    { busca, inicio: `${busca}%`, like: `%${busca}%` });
    res.json(linhas.map((i) => ({
      icps: i.ICPS, codigo: i.Cod, descricao: i.Descr, preco: lerNumero(i.PrecVen),
      custo: lerNumero(i.Custo), unidade: i.UNMED, estoque: lerNumero(i.Estoque),
    })));
  });

  r.get('/servicos', async (req, res) => {
    const busca = texto(req.query.busca, 60);
    const linhas = await consultar(`SELECT TOP 30 Id, Codigo, Descr, Valor, Custo FROM Servicos
      WHERE @busca = '' OR Codigo = @busca OR Descr COLLATE Latin1_General_CI_AI LIKE @like ORDER BY Descr`,
    { busca, like: `%${busca}%` });
    res.json(linhas.map((s) => ({
      id: s.Id, codigo: s.Codigo, descricao: s.Descr, valor: lerNumero(s.Valor), custo: lerNumero(s.Custo),
    })));
  });

  // Abrir OS: INSERT do cabecalho + texto do Simples em DadosAdicionais
  r.post('/os', async (req, res) => {
    const b = req.body ?? {};
    // Cliente opcional: o SantSystem tem OS com ChvCad vazio
    const clienteId = Number(b.clienteId) || 0;
    const hoje = dataNumero();
    // So nomes das listas do SantSystem, senao a OS aparece sem marca/modelo la
    const veiculo = await resolverVeiculo(b.marca, b.modelo);
    const id = await emTransacao(async (nova) => {
      if (clienteId) {
        const [cli] = (await nova({ c: clienteId }).query(
          'SELECT ChvCadastros FROM Cadastros WHERE ChvCadastros = @c AND ISNULL(Excluido, 0) <> 1')).recordset;
        if (!cli) throw new ErroDeUso('Cliente não encontrado', 404);
      }
      const [nova_os] = (await nova({
        cad: clienteId ? String(clienteId) : '', hoje, func: '', placa: placa(b.placa),
        marca: veiculo.marca, modelo: veiculo.modelo, ano: texto(b.ano, 10), cor: texto(b.cor, 30),
        km: texto(b.km, 20), obs: texto(b.obs, 2000), zero2: '0,00', zero3: '0,000', zero4: '0,0000',
      }).query(`INSERT INTO PedVendaCab (ChvCad, DtPed, DtPrev, DtVal, Final, ST, ipi, Outros, TotItens, TotDesc,
          TotalPed, OBS, Excluido, NR_CHAVE_ACESSO_REFERENCIA, ChvFunc, UF_PLACA, PlacaVei, Vl_Br_Serv, Perc_Desc_Serv,
          Vl_Desc_Serv, Vl_LQ_Serv, Marca, Modelo, Ano_Veiculo, Combustivel, Cor, KM, Motor, TxtTotGer, NVMovel, Transp,
          Contato, formaPgt, TipFret, TxtVlFret, TxtPlac, TXTQtdV, TxtEsp, TxtMarc, TxtNum, TxtPb, TxtPLiq, TxtPraz,
          DadAd, TxtNNFE, NatOp, NfES, Pres, DescP, Origem, CKMVO, TotCusServ, TotCusItens, BP, VlComis)
        OUTPUT INSERTED.Id
        VALUES (@cad, @hoje, @hoje, @hoje, '0', @zero2, @zero2, @zero2, @zero2, @zero4,
          @zero2, @obs, '0', '', @func, '', @placa, @zero2, @zero4,
          @zero4, @zero2, @marca, @modelo, @ano, '', @cor, @km, '', @zero2, '0', '',
          '', '', '9', @zero2, '___-____', '01', 'Volume', 'Diversos', '01', @zero3, @zero3, '',
          '', '', '', 'S', '1', @zero4, 'O.S', 'Venda', @zero2, @zero2, 'NãoConfig', 'NãoConfig')`)).recordset;
      await nova({ id: nova_os.Id, dad: DADOS_ADICIONAIS }).query(
        'UPDATE PedVendaCab SET DadosAdicionais = @dad WHERE id = @id');
      return { id: nova_os.Id, previa: ensaio(req) ? await previa(nova, nova_os.Id) : undefined };
    }, { ensaio: ensaio(req) });
    res.status(201).json({ ...id, ensaio: ensaio(req) });
  });

  // Alterar dados do cabecalho (veiculo, km, observacao) e o cliente
  // (clienteId 0/vazio = sem cliente; as pecas da OS acompanham o ChvCad)
  r.patch('/os/:id', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const trocaCliente = b.clienteId !== undefined;
    const clienteId = Number(b.clienteId) || 0;
    // Marca e modelo andam juntos: confere o par contra as listas do SantSystem
    let veiculo;
    if (b.marca !== undefined || b.modelo !== undefined) {
      const [atual] = await consultar('SELECT Marca, Modelo FROM PedVendaCab WHERE Id = @id', { id });
      veiculo = await resolverVeiculo(b.marca ?? atual?.Marca, b.modelo ?? atual?.Modelo);
    }
    const campos = {
      ChvCad: trocaCliente ? (clienteId ? String(clienteId) : '') : undefined,
      PlacaVei: b.placa !== undefined ? placa(b.placa) : undefined,
      Marca: veiculo?.marca,
      Modelo: veiculo?.modelo,
      Ano_Veiculo: b.ano !== undefined ? texto(b.ano, 10) : undefined,
      Cor: b.cor !== undefined ? texto(b.cor, 30) : undefined,
      KM: b.km !== undefined ? texto(b.km, 20) : undefined,
      OBS: b.obs !== undefined ? texto(b.obs, 2000) : undefined,
    };
    const usar = Object.entries(campos).filter(([, v]) => v !== undefined);
    if (!usar.length) throw new ErroDeUso('Nada para alterar');
    await emTransacao(async (nova) => {
      await osEditavel(nova, id);
      if (clienteId) {
        const [cli] = (await nova({ c: clienteId }).query(
          'SELECT ChvCadastros FROM Cadastros WHERE ChvCadastros = @c AND ISNULL(Excluido, 0) <> 1')).recordset;
        if (!cli) throw new ErroDeUso('Cliente não encontrado', 404);
      }
      const params = Object.fromEntries(usar.map(([k, v]) => [k, v]));
      await nova({ ...params, id }).query(
        `UPDATE PedVendaCab SET ${usar.map(([k]) => `${k} = @${k}`).join(', ')} WHERE Id = @id`);
      if (trocaCliente) {
        await nova({ cad: campos.ChvCad, os: String(id) }).query(
          'UPDATE PedVendaProd SET ChvCad = @cad WHERE ChvPed = @os');
      }
      return ensaio(req) ? await previa(nova, id) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  // Excluir OS: exclusao logica do cabecalho e das pecas (servicos nao sao marcados)
  r.delete('/os/:id', async (req, res) => {
    const id = Number(req.params.id);
    await emTransacao(async (nova) => {
      await osEditavel(nova, id);
      await nova({ id: String(id) }).query("UPDATE PedVendaCab SET excluido = '1' WHERE id LIKE @id");
      await nova({ id: String(id) }).query("UPDATE PedVendaProd SET excluido = '1' WHERE ChvPed LIKE @id");
      return ensaio(req) ? await previa(nova, id) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  // Lancar peca: INSERT em PedVendaProd + totais do cabecalho
  r.post('/os/:id/pecas', async (req, res) => {
    const osId = Number(req.params.id);
    const b = req.body ?? {};
    const qtd = Number(b.quantidade) || 1;
    if (qtd <= 0) throw new ErroDeUso('Quantidade inválida');
    const pre = await prefixo();
    const pecaId = await emTransacao(async (nova) => {
      const os = await osEditavel(nova, osId);
      // O codigo e resolvido pela tabela codigos (como o SantSystem): ha codigos repetidos em Itens
      // (ex.: 559 = rolamento e kit da barra) e so a codigos diz qual item e o certo
      const [item] = (await nova({ cod: texto(b.codigo, 50) }).query(
        `SELECT TOP 1 ICPS, Cod, Descr, PrecVen, Custo, UNMED, NCM, CFOP, MRegra, RDE FROM Itens
          WHERE ICPS = (SELECT TOP 1 TRY_CAST(ChvProd AS int) FROM codigos WHERE Cod = @cod)
             OR (Cod = @cod AND NOT EXISTS (SELECT 1 FROM codigos WHERE Cod = @cod))
          ORDER BY ICPS`)).recordset;
      if (!item) throw new ErroDeUso('Peça não encontrada', 404);
      const unit = b.valorUnitario !== undefined ? Number(b.valorUnitario) : lerNumero(item.PrecVen);
      const sub = unit * qtd;
      const { cfop, cst } = await fiscal(nova, os.ChvCad, item);
      const [{ prox }] = (await nova({ os: String(osId) }).query(
        'SELECT ISNULL(MAX(TRY_CAST(Nitem AS int)), 0) + 1 AS prox FROM PedVendaProd WHERE ChvPed = @os')).recordset;
      const ncm = String(item.NCM || String(item.MRegra ?? '').split('|')[0] || '').trim();
      const [linha] = (await nova({
        os: String(osId), cad: String(os.ChvCad), nitem: String(prox), cod: item.Cod,
        descr: texto(b.descricao, 200) || item.Descr, qtd: quantidade(qtd), unit: dinheiro(unit), sub: dinheiro(sub),
        un: item.UNMED || 'UN', ncm, regra: String(item.RDE || 'A').trim(), icps: String(item.ICPS), cst, cfop,
        ident: identificador(pre),
        custo: dinheiro(b.custo !== undefined ? Number(b.custo) : lerNumero(item.Custo) * qtd),
      }).query(`INSERT INTO PedVendaProd (ChvPed, ChvCad, Nitem, Cod, Descr, QtdPed, QtdVnd, VlUnitBr, VlDesc, VlIPI,
          VlST, VlLiq, SubTotPed, SubTotVnd, UnMed, NCM, Regra, PIpi, PIVA, ICPS, ICMSOrigem, ICMSDestino, TipDesc,
          PrcUtil, NPedCliente, NItemCliente, Excluido, CSTICMS, Baixado, CFOP, Calc, Identificador, Custo, BP, PeCom, VlComis)
        OUTPUT INSERTED.Id
        VALUES (@os, @cad, @nitem, @cod, @descr, @qtd, @qtd, @unit, '0,00%', '0,00',
          '0,0000', @unit, @sub, @sub, @un, @ncm, @regra, '0,00', '0,00', @icps, '0,00', '0,00', 'P',
          '1', '', '', '0', @cst, 'Não', @cfop, '1', @ident, @custo, 'NãoConfig', 'NãoConfig', 'NãoConfig')`)).recordset;
      await recalcular(nova, osId);
      return { id: linha.Id, previa: ensaio(req) ? await previa(nova, osId, { pecaId: linha.Id }) : undefined };
    }, { ensaio: ensaio(req) });
    res.status(201).json({ ...pecaId, ensaio: ensaio(req) });
  });

  // Alterar quantidade/preco/descricao da peca
  r.patch('/os/:id/pecas/:pecaId', async (req, res) => {
    const osId = Number(req.params.id);
    const pecaId = Number(req.params.pecaId);
    const b = req.body ?? {};
    await emTransacao(async (nova) => {
      await osEditavel(nova, osId);
      const [p] = (await nova({ id: pecaId, os: String(osId) }).query(
        "SELECT QtdPed, VlUnitBr, Custo, Descr FROM PedVendaProd WHERE Id = @id AND ChvPed = @os AND Excluido = '0'")).recordset;
      if (!p) throw new ErroDeUso('Peça não encontrada nesta OS', 404);
      const qtdAntiga = lerNumero(p.QtdPed) || 1;
      const qtd = b.quantidade !== undefined ? Number(b.quantidade) : qtdAntiga;
      if (!(qtd > 0)) throw new ErroDeUso('Quantidade inválida');
      const unit = b.valorUnitario !== undefined ? Number(b.valorUnitario) : lerNumero(p.VlUnitBr);
      const custo = b.custo !== undefined ? Number(b.custo) : (lerNumero(p.Custo) / qtdAntiga) * qtd;
      await nova({
        id: pecaId, qtd: quantidade(qtd), unit: dinheiro(unit), sub: dinheiro(unit * qtd), custo: dinheiro(custo),
        descr: b.descricao !== undefined ? texto(b.descricao, 200) : p.Descr,
      }).query(`UPDATE PedVendaProd SET QtdPed = @qtd, QtdVnd = @qtd, VlUnitBr = @unit, VlLiq = @unit,
          SubTotPed = @sub, SubTotVnd = @sub, Custo = @custo, Descr = @descr WHERE Id = @id`);
      await recalcular(nova, osId);
      return ensaio(req) ? await previa(nova, osId, { pecaId }) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  // Remover peca: exclusao logica como o SantSystem (docs/RECEITAS.md, peca 42960 na OS 15316)
  r.delete('/os/:id/pecas/:pecaId', async (req, res) => {
    const osId = Number(req.params.id);
    const pecaId = Number(req.params.pecaId);
    await emTransacao(async (nova) => {
      await osEditavel(nova, osId);
      const alterou = (await nova({ id: pecaId, os: String(osId) }).query(
        "UPDATE PedVendaProd SET Excluido = '1', Baixado = 'Não' WHERE Id = @id AND ChvPed = @os AND Excluido = '0'"))
        .rowsAffected[0];
      if (!alterou) throw new ErroDeUso('Peça não encontrada nesta OS', 404);
      // Movimento de estoque so existe se a peca ja tinha sido baixada (em OS aberta, nenhuma linha)
      const filtro = { id: String(pecaId), os: String(osId) };
      await nova(filtro).query(`UPDATE Produtos SET Sit = '12', TipMov = 'Excluido ' + TipMov
        WHERE idOrigem = @id AND TipMov = 'O.S' AND idvenda = @os`);
      await nova(filtro).query(`UPDATE Produtos26_4 SET Sit = '2', TipMov = TipMov + 'Excluido O.S'
        WHERE idOrigem = @id AND TipMov = 'O.S' AND idvenda = @os`);
      await recalcular(nova, osId);
      // Sem pecas, o texto da nota volta a ser so o do Simples
      const [{ restam }] = (await nova({ os: String(osId) }).query(
        "SELECT COUNT(*) AS restam FROM PedVendaProd WHERE ChvPed = @os AND Excluido = '0'")).recordset;
      if (!restam) {
        await nova({ id: osId, dad: DADOS_ADICIONAIS }).query('UPDATE PedVendaCab SET DadosAdicionais = @dad WHERE Id = @id');
      }
      return ensaio(req) ? await previa(nova, osId, { pecaId }) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  // Lancar servico: INSERT em Servicos_OS (mesmo SQL do SantSystem) + totais
  r.post('/os/:id/servicos', async (req, res) => {
    const osId = Number(req.params.id);
    const b = req.body ?? {};
    const qtd = Number(b.quantidade) || 1;
    const pre = await prefixo();
    const servicoId = await emTransacao(async (nova) => {
      await osEditavel(nova, osId);
      const [s] = (await nova({ id: Number(b.servicoId) }).query(
        'SELECT Id, Codigo, Descr, Valor, Custo FROM Servicos WHERE Id = @id')).recordset;
      if (!s) throw new ErroDeUso('Serviço não encontrado', 404);
      const unit = b.valorUnitario !== undefined ? Number(b.valorUnitario) : lerNumero(s.Valor);
      const [linha] = (await nova({
        cod: s.Codigo, descr: texto(b.descricao, 300) || s.Descr, qtd: String(qtd), unit: dinheiro(unit),
        sub: dinheiro(unit * qtd), obs: texto(b.obs, 300), idServ: String(s.Id),
        func: '', os: String(osId),
        guid: identificador(pre), custo: dinheiro(b.custo !== undefined ? Number(b.custo) : 0),
      }).query(`INSERT INTO Servicos_OS (Codigo, Descr, Quant, VlUnit, SubTot, Obs_Servico, Perc_Comissao, VL_Comissao,
          Id_Servico, Id_Funcionario, Id_Venda, Sit, Guid_Linha, Custo, Terceirizado, BP)
        OUTPUT INSERTED.Id
        VALUES (@cod, @descr, @qtd, @unit, @sub, @obs, '0,000', '0,00',
          @idServ, @func, @os, 'N', @guid, @custo, 'Não', 'Pendente')`)).recordset;
      await recalcular(nova, osId);
      return { id: linha.Id, previa: ensaio(req) ? await previa(nova, osId, { servicoId: linha.Id }) : undefined };
    }, { ensaio: ensaio(req) });
    res.status(201).json({ ...servicoId, ensaio: ensaio(req) });
  });

  // Alterar servico (mesmo UPDATE do SantSystem)
  r.patch('/os/:id/servicos/:servicoId', async (req, res) => {
    const osId = Number(req.params.id);
    const servicoId = Number(req.params.servicoId);
    const b = req.body ?? {};
    await emTransacao(async (nova) => {
      await osEditavel(nova, osId);
      const [s] = (await nova({ id: servicoId, os: String(osId) }).query(
        "SELECT Descr, Quant, VlUnit, Custo FROM Servicos_OS WHERE Id = @id AND Id_Venda = @os AND ISNULL(Sit, 'N') <> 'EX'")).recordset;
      if (!s) throw new ErroDeUso('Serviço não encontrado nesta OS', 404);
      const qtd = b.quantidade !== undefined ? Number(b.quantidade) : lerNumero(s.Quant);
      const unit = b.valorUnitario !== undefined ? Number(b.valorUnitario) : lerNumero(s.VlUnit);
      await nova({
        id: servicoId, descr: b.descricao !== undefined ? texto(b.descricao, 300) : s.Descr, qtd: String(qtd),
        unit: dinheiro(unit), sub: dinheiro(unit * qtd),
        custo: dinheiro(b.custo !== undefined ? Number(b.custo) : lerNumero(s.Custo)),
      }).query(`UPDATE Servicos_OS SET Descr = @descr, Quant = @qtd, VlUnit = @unit, SubTot = @sub, Custo = @custo
        WHERE id = @id`);
      await recalcular(nova, osId);
      return ensaio(req) ? await previa(nova, osId, { servicoId }) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  // Remover servico: o SantSystem so marca Sit = 'EX' na linha (ex.: servico 16889 da OS 15362) + totais
  r.delete('/os/:id/servicos/:servicoId', async (req, res) => {
    const osId = Number(req.params.id);
    const servicoId = Number(req.params.servicoId);
    await emTransacao(async (nova) => {
      await osEditavel(nova, osId);
      const alterou = (await nova({ id: servicoId, os: String(osId) }).query(
        "UPDATE Servicos_OS SET Sit = 'EX' WHERE Id = @id AND Id_Venda = @os AND ISNULL(Sit, 'N') <> 'EX'")).rowsAffected[0];
      if (!alterou) throw new ErroDeUso('Serviço não encontrado nesta OS', 404);
      await recalcular(nova, osId);
      return ensaio(req) ? await previa(nova, osId, { servicoId }) : undefined;
    }, { ensaio: ensaio(req) }).then((p) => res.json({ ok: true, ensaio: ensaio(req), previa: p }));
  });

  return r;
}

export { ErroDeUso, sql };
