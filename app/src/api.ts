import AsyncStorage from '@react-native-async-storage/async-storage';

export type Config = {
  url: string;
  token: string;
  funcionarioId: number | null;
  funcionarioNome: string;
};

export type ResumoOS = {
  id: number;
  clienteId: number;
  cliente: string | null;
  funcionarioId: number | null;
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  km: string;
  obs: string;
  abertura: string | null;
  fim: string | null;
  finalizada: boolean;
  excluida: boolean;
  totalPecas: number;
  totalServicos: number;
  total: number;
};

export type PecaOS = {
  id: number;
  item: number;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  custo: number;
  baixada: boolean;
};

export type ServicoOS = {
  id: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  custo: number;
  funcionarioId: number | null;
};

export type OS = ResumoOS & { pecas: PecaOS[]; servicos: ServicoOS[] };

export type Cliente = {
  id: number;
  nome: string;
  fantasia: string;
  documento: string;
  celular: string;
  telefone: string;
  cidade: string;
  uf: string;
};

export type ClienteCompleto = {
  id?: number;
  tipo: 'F' | 'J';
  nome: string;
  apelido: string;
  documento: string;
  rg: string;
  nascimento: string;
  celular: string;
  telefone: string;
  email: string;
  cep: string;
  tipoEndereco: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoCidade: string;
  obs: string;
};

export type Veiculo = { placa: string; marca: string; modelo: string; ano: string; cor: string; km: string };
export type Peca = {
  icps: number; codigo: string; descricao: string; preco: number; custo: number; unidade: string; estoque: number;
};
export type Servico = { id: number; codigo: string; descricao: string; valor: number; custo: number };
export type Funcionario = { id: number; nome: string };
export type Marca = { id: number; marca: string };
export type Modelo = { id: number; modelo: string };

// Erro da API com o codigo que o app sabe tratar (ex.: modelo_novo)
export class ErroApi extends Error {
  codigo?: string;
  dados: Record<string, unknown>;

  constructor(mensagem: string, codigo?: string, dados: Record<string, unknown> = {}) {
    super(mensagem);
    this.codigo = codigo;
    this.dados = dados;
  }
}

const CHAVE = 'santsystem:config';
let atual: Config | null = null;

export async function lerConfig(): Promise<Config | null> {
  try {
    const texto = await AsyncStorage.getItem(CHAVE);
    atual = texto ? (JSON.parse(texto) as Config) : null;
  } catch {
    atual = null;
  }
  return atual;
}

export async function salvarConfig(config: Config) {
  atual = config;
  await AsyncStorage.setItem(CHAVE, JSON.stringify(config));
}

export function configAtual() {
  return atual;
}

type Opcoes = { metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; corpo?: unknown; config?: Pick<Config, 'url' | 'token'> };

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const cfg = opcoes.config ?? atual;
  if (!cfg) throw new Error('Configure o endereço da API');
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 15000);
  try {
    const resposta = await fetch(`${cfg.url.replace(/\/$/, '')}${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      headers: { 'x-token': cfg.token, 'content-type': 'application/json' },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: controle.signal,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const { erro, codigo, ...resto } = dados ?? {};
      throw new ErroApi(erro ?? `Erro ${resposta.status}`, codigo, resto);
    }
    return dados as T;
  } catch (erro) {
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new Error('A API não respondeu. O PC da oficina está ligado e o celular no Wi-Fi da oficina?');
    }
    if (erro instanceof TypeError) {
      throw new Error('Sem conexão com a API. Confira o endereço e o Wi-Fi.');
    }
    throw erro;
  } finally {
    clearTimeout(tempo);
  }
}
