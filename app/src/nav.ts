export type Rota =
  | { tela: 'lista' }
  | { tela: 'config' }
  | { tela: 'os'; id: number }
  | { tela: 'nova' }
  | { tela: 'peca'; osId: number }
  | { tela: 'servico'; osId: number }
  | { tela: 'clientes' }
  | { tela: 'precos' }
  | { tela: 'cliente'; id?: number };

export type Nav = {
  ir: (rota: Rota) => void;
  voltar: () => void;
  // Substitui a tela atual (ex.: depois de abrir a OS, ir direto para ela)
  trocar: (rota: Rota) => void;
};
