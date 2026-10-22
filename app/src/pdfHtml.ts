// Modelo HTML do PDF da OS. Sem dependencias (nem React Native) para poder
// gerar uma previa fora do celular: node --experimental-strip-types.

function moeda(valor: number) {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  return `${valor < 0 ? '-' : ''}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

function dataBR(iso: string | null) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// O que a API manda para o PDF. Ela ja tira observacoes e custos: nada disso
// pode ir para o papel do cliente.
export type DadosImpressao = {
  empresa: {
    nome: string; razaoSocial: string; cnpj: string; ie: string; endereco: string; bairro: string;
    cidade: string; uf: string; cep: string; telefone: string; email: string;
  } | null;
  cliente: {
    codigo: number; nome: string; tipo: 'F' | 'J'; documento: string; endereco: string; bairro: string;
    cidade: string; uf: string; cep: string; celular: string; telefone: string; email: string;
  } | null;
  os: {
    id: number; abertura: string | null; fim: string | null; finalizada: boolean; excluida: boolean;
    placa: string; marca: string; modelo: string; ano: string; cor: string; km: string;
  };
  pecas: { codigo: string; descricao: string; unidade: string; quantidade: number; valorUnitario: number; subtotal: number }[];
  servicos: { descricao: string; quantidade: number; valorUnitario: number; subtotal: number }[];
  totais: { pecas: number; servicos: number; descontoServicos: number; total: number };
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const digitos = (v: string) => v.replace(/\D/g, '');

function documento(v: string) {
  const d = digitos(v);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

function fone(v: string) {
  const d = digitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

function cep(v: string) {
  const d = digitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
}

const qtd = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace('.', ','));

function linha(rotulo: string, valor: string) {
  return valor ? `<div class="campo"><span>${esc(rotulo)}</span> ${esc(valor)}</div>` : '';
}

export function htmlDaOS(d: DadosImpressao) {
  const e = d.empresa;
  const c = d.cliente;
  const o = d.os;
  const cidadeUf = (cidade: string, uf: string) => [cidade, uf].filter(Boolean).join(' - ');

  const pecas = d.pecas.length ? `
    <h2>Peças</h2>
    <table>
      <thead><tr><th class="cod">Cód.</th><th>Descrição</th><th class="num">Qtd</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
      <tbody>${d.pecas.map((p) => `
        <tr><td class="cod">${esc(p.codigo)}</td><td>${esc(p.descricao)}</td>
        <td class="num">${esc(qtd(p.quantidade))} ${esc(p.unidade)}</td>
        <td class="num">${esc(moeda(p.valorUnitario))}</td><td class="num">${esc(moeda(p.subtotal))}</td></tr>`).join('')}
      </tbody>
    </table>` : '';

  const servicos = d.servicos.length ? `
    <h2>Serviços</h2>
    <table>
      <thead><tr><th>Descrição</th><th class="num">Qtd</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
      <tbody>${d.servicos.map((s) => `
        <tr><td>${esc(s.descricao)}</td><td class="num">${esc(qtd(s.quantidade))}</td>
        <td class="num">${esc(moeda(s.valorUnitario))}</td><td class="num">${esc(moeda(s.subtotal))}</td></tr>`).join('')}
      </tbody>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 11px; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .oficina h1 { font-size: 20px; margin: 0 0 2px; }
  .oficina div { line-height: 1.45; }
  .numero { text-align: right; }
  .numero .titulo { font-size: 11px; letter-spacing: 1px; color: #444; }
  .numero .os { font-size: 24px; font-weight: bold; }
  .numero div { line-height: 1.5; }
  .blocos { display: flex; gap: 10px; margin-top: 10px; }
  .bloco { flex: 1; border: 1px solid #999; border-radius: 4px; padding: 6px 8px; }
  .bloco h3 { margin: 0 0 4px; font-size: 10px; letter-spacing: 1px; color: #444; }
  .bloco .nome { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
  .campo { line-height: 1.5; }
  .campo span { color: #555; }
  h2 { font-size: 12px; margin: 14px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; color: #444; border-bottom: 1px solid #111; padding: 4px; }
  td { padding: 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .cod { white-space: nowrap; width: 60px; }
  .totais { margin-top: 12px; margin-left: auto; width: 45%; }
  .totais div { display: flex; justify-content: space-between; padding: 3px 4px; }
  .totais .geral { border-top: 2px solid #111; font-size: 15px; font-weight: bold; margin-top: 2px; }
  .assinatura { margin-top: 48px; display: flex; gap: 40px; }
  .assinatura div { flex: 1; border-top: 1px solid #111; text-align: center; padding-top: 4px; color: #444; }
  .rodape { margin-top: 18px; font-size: 9px; color: #666; text-align: center; }
</style></head>
<body>
  <div class="topo">
    <div class="oficina">
      ${e ? `<h1>${esc(e.nome)}</h1>
      <div>${esc(e.razaoSocial)}</div>
      <div>CNPJ ${esc(documento(e.cnpj))}${e.ie ? ` · IE ${esc(e.ie)}` : ''}</div>
      <div>${esc(e.endereco)}${e.bairro ? ` · ${esc(e.bairro)}` : ''}</div>
      <div>${esc(cidadeUf(e.cidade, e.uf))}${e.cep ? ` · CEP ${esc(cep(e.cep))}` : ''}</div>
      <div>${[e.telefone, e.email].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
    </div>
    <div class="numero">
      <div class="titulo">ORDEM DE SERVIÇO</div>
      <div class="os">Nº ${esc(o.id)}</div>
      <div>Abertura: ${esc(dataBR(o.abertura))}</div>
      ${o.finalizada && o.fim ? `<div>Finalizada: ${esc(dataBR(o.fim))}</div>` : ''}
    </div>
  </div>

  <div class="blocos">
    <div class="bloco">
      <h3>CLIENTE</h3>
      ${c ? `<div class="nome">${esc(c.nome)}</div>
      ${linha(c.tipo === 'J' ? 'CNPJ:' : 'CPF:', c.documento ? documento(c.documento) : '')}
      ${linha('Celular:', c.celular ? fone(c.celular) : '')}
      ${linha('Telefone:', c.telefone ? fone(c.telefone) : '')}
      ${linha('E-mail:', c.email)}
      ${linha('Endereço:', c.endereco)}
      ${linha('', [c.bairro, cidadeUf(c.cidade, c.uf), c.cep ? `CEP ${cep(c.cep)}` : ''].filter(Boolean).join(' · '))}`
      : '<div class="campo">Não informado</div>'}
    </div>
    <div class="bloco">
      <h3>VEÍCULO</h3>
      <div class="nome">${esc(o.placa || 'Sem placa')}</div>
      ${linha('Veículo:', [o.marca, o.modelo].filter(Boolean).join(' '))}
      ${linha('Ano:', o.ano)}
      ${linha('Cor:', o.cor)}
      ${linha('KM:', o.km)}
    </div>
  </div>

  ${pecas}
  ${servicos}

  <div class="totais">
    ${d.pecas.length ? `<div><span>Peças</span><span>${esc(moeda(d.totais.pecas))}</span></div>` : ''}
    ${d.servicos.length ? `<div><span>Serviços</span><span>${esc(moeda(d.totais.servicos))}</span></div>` : ''}
    ${d.totais.descontoServicos > 0 ? `<div><span>Desconto nos serviços</span><span>- ${esc(moeda(d.totais.descontoServicos))}</span></div>` : ''}
    <div class="geral"><span>TOTAL</span><span>${esc(moeda(d.totais.total))}</span></div>
  </div>

  <div class="assinatura"><div>${esc(e?.nome ?? 'Oficina')}</div><div>Cliente</div></div>
  <div class="rodape">Documento sem valor fiscal.</div>
</body></html>`;
}
