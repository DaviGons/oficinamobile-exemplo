// Marca e modelo do veiculo como o SantSystem cadastra (Veiculo_Marca / Veiculo_Modelo, Sit 'E' = excluido).
// A tela de OS do SantSystem so mostra marca/modelo que existem nessas listas: "GM" em vez de
// "CHEVROLET (GM)" fica em branco la. Por isso a OS so recebe nomes das listas, escritos igual.
import { consultar } from './db.js';
import { texto } from './formato.js';

// Jeitos comuns de digitar -> nome cadastrado no SantSystem (as chaves ja passam por chave())
const APELIDOS = {
  GM: 'CHEVROLET (GM)',
  CHEVROLET: 'CHEVROLET (GM)',
  VOLKSWAGEN: 'VW',
  VOLKSWAGEM: 'VW',
  VOLKS: 'VW',
  VOLKXWAGEM: 'VW',
  'MERCEDES BENZ': 'MERCEDES',
  BENZ: 'MERCEDES',
  'KIA MOTORS': 'KIA',
  CITROEM: 'CITROEN',
  LANDROVER: 'LAND ROVER',
  MINI: 'MINI COOPER',
};

// Maiusculas, sem acento, sem pontuacao e com um espaco so: "Chevrolet (GM)" -> "CHEVROLET GM"
export function chave(v) {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z0-9!]+/g, ' ').trim();
}

const apelidos = new Map(Object.entries(APELIDOS).map(([k, v]) => [chave(k), v]));

export async function marcas() {
  return consultar(`SELECT Id AS id, Marca AS marca FROM Veiculo_Marca
    WHERE ISNULL(Sit, 'N') <> 'E' AND LTRIM(RTRIM(Marca)) <> '' ORDER BY Marca`);
}

export async function modelos(marcaId) {
  return consultar(`SELECT MIN(Id) AS id, Modelo AS modelo FROM Veiculo_Modelo
    WHERE IdMarca = @m AND ISNULL(Sit, 'N') <> 'E' AND LTRIM(RTRIM(Modelo)) <> ''
    GROUP BY Modelo ORDER BY Modelo`, { m: String(marcaId) });
}

export class VeiculoInvalido extends Error {
  constructor(mensagem, codigo, dados = {}) {
    super(mensagem);
    this.status = 422;
    this.codigo = codigo;
    this.dados = dados;
  }
}

// Acha a marca cadastrada pelo que foi digitado (nome exato, sem acento/pontuacao ou apelido)
export async function acharMarca(digitada) {
  const k = chave(digitada);
  if (!k) return null;
  const lista = await marcas();
  const porChave = (alvo) => lista.find((m) => chave(m.marca) === chave(alvo));
  return porChave(digitada) ?? (apelidos.has(k) ? porChave(apelidos.get(k)) : null) ?? null;
}

// Devolve { marca, modelo } exatamente como estao nas listas do SantSystem.
// Vazios continuam vazios (orcamento sem carro). Modelo sem marca: procura em todas as marcas.
export async function resolverVeiculo(marcaDigitada, modeloDigitado) {
  const marcaTxt = texto(marcaDigitada, 50);
  const modeloTxt = texto(modeloDigitado, 50);
  if (!marcaTxt && !modeloTxt) return { marca: '', modelo: '' };

  let marca = marcaTxt ? await acharMarca(marcaTxt) : null;
  if (marcaTxt && !marca) {
    throw new VeiculoInvalido(`A marca "${marcaTxt}" não existe no SantSystem. Escolha uma da lista.`, 'marca_invalida');
  }

  if (!modeloTxt) return { marca: marca.marca, modelo: '' };

  if (!marca) {
    // So o modelo: vale se ele existe em uma unica marca
    const achados = await consultar(`SELECT DISTINCT m.Id AS id, m.Marca AS marca, o.Modelo AS modelo
      FROM Veiculo_Modelo o JOIN Veiculo_Marca m ON CAST(m.Id AS varchar(10)) = o.IdMarca
      WHERE ISNULL(o.Sit, 'N') <> 'E' AND ISNULL(m.Sit, 'N') <> 'E'`);
    const iguais = achados.filter((a) => chave(a.modelo) === chave(modeloTxt));
    if (iguais.length === 1) return { marca: iguais[0].marca, modelo: iguais[0].modelo };
    throw new VeiculoInvalido('Escolha a marca do veículo.', 'marca_invalida');
  }

  const lista = await modelos(marca.id);
  const achado = lista.find((m) => chave(m.modelo) === chave(modeloTxt));
  if (!achado) {
    throw new VeiculoInvalido(
      `O modelo "${modeloTxt.toUpperCase()}" não está cadastrado na marca ${marca.marca} do SantSystem.`,
      'modelo_novo', { marca: marca.marca, modelo: modeloTxt.toUpperCase() },
    );
  }
  return { marca: marca.marca, modelo: achado.modelo };
}

// Para preencher a OS nova com o carro de uma OS antiga: o que der para casar com as listas
// vem no nome certo; marca desconhecida vem vazia e o modelo fica como estava (o app pede para escolher)
export async function veiculoSugerido(marcaAntiga, modeloAntigo) {
  try {
    return await resolverVeiculo(marcaAntiga, modeloAntigo);
  } catch {
    const marca = await acharMarca(marcaAntiga);
    return { marca: marca?.marca ?? '', modelo: texto(modeloAntigo, 50).toUpperCase() };
  }
}

// Cadastra um modelo novo como o SantSystem (Sit 'N'; Identificador/BKP ficam nulos, como o MAVERICK)
export async function cadastrarModelo(nova, marcaDigitada, modeloDigitado) {
  const marca = await acharMarca(marcaDigitada);
  if (!marca) throw new VeiculoInvalido(`A marca "${texto(marcaDigitada, 50)}" não existe no SantSystem.`, 'marca_invalida');
  const modelo = texto(modeloDigitado, 50).toUpperCase().replace(/\s+/g, ' ');
  if (!modelo) throw new VeiculoInvalido('Informe o modelo.', 'modelo_vazio');
  const existente = (await modelos(marca.id)).find((m) => chave(m.modelo) === chave(modelo));
  if (existente) return { id: existente.id, marca: marca.marca, modelo: existente.modelo, novo: false };
  const [linha] = (await nova({ modelo, m: String(marca.id) }).query(`INSERT INTO Veiculo_Modelo (Modelo, IdMarca, Sit)
    OUTPUT INSERTED.Id VALUES (@modelo, @m, 'N')`)).recordset;
  return { id: linha.Id, marca: marca.marca, modelo, novo: true };
}
