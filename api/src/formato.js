// Conversoes para o jeito que o SantSystem guarda os dados: quase tudo e
// varchar, com virgula decimal e datas como numero de dias desde 30/12/1899.
import { randomUUID } from 'node:crypto';

const BASE_DATA = Date.UTC(1899, 11, 30);

export function lerNumero(texto) {
  if (texto === null || texto === undefined) return 0;
  const limpo = String(texto).replace('%', '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function comCasas(n, casas) {
  return (Math.round(Number(n) * 10 ** casas) / 10 ** casas).toFixed(casas).replace('.', ',');
}

export const dinheiro = (n) => comCasas(n, 2);
export const quantidade = (n) => comCasas(n, 3);
export const percentual = (n) => comCasas(n, 4);

// Partes da data/hora no fuso da oficina, independente do fuso do servidor
function partes(agora = new Date()) {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(agora).map((x) => [x.type, x.value]));
  return { dia: p.day, mes: p.month, ano: p.year, hora: p.hour, min: p.minute, seg: p.second };
}

export function dataNumero(agora = new Date()) {
  const p = partes(agora);
  return String(Math.round((Date.UTC(+p.ano, +p.mes - 1, +p.dia) - BASE_DATA) / 86400000));
}

export function dataDeNumero(numero) {
  const n = Number(String(numero ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(BASE_DATA + Math.floor(n) * 86400000).toISOString().slice(0, 10);
}

// Mesmo formato dos identificadores gravados pelo SantSystem (50 caracteres):
// <ConfigSis VERSAO.cp5><ddmmaaaa><hhmmss>12<29 hex>
export function identificador(prefixo, agora = new Date()) {
  const p = partes(agora);
  const aleatorio = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 29);
  return `${prefixo}${p.dia}${p.mes}${p.ano}${p.hora}${p.min}${p.seg}12${aleatorio}`;
}

// Placa no formato gravado pelo SantSystem: AAA-9999 / AAA-9A99; vazia = ___-____
export function placa(texto) {
  const so = String(texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!so) return '___-____';
  return so.length > 3 ? `${so.slice(0, 3)}-${so.slice(3, 7)}` : so;
}

export function texto(valor, max = 500) {
  return String(valor ?? '').replace(/'/g, '').trim().slice(0, max);
}

export function dataTexto(agora = new Date()) {
  const p = partes(agora);
  return `${p.dia}/${p.mes}/${p.ano}`;
}

export function horaTexto(agora = new Date()) {
  const p = partes(agora);
  return `${p.hora}:${p.min}:${p.seg}`;
}

// Hora como fracao do dia, como o SantSystem grava em HoraAlt (16:01:09 = 0,667465)
export function horaFracao(agora = new Date()) {
  const p = partes(agora);
  return ((+p.hora * 3600 + +p.min * 60 + +p.seg) / 86400).toFixed(6).replace('.', ',');
}

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// Telefone no formato dos cadastros recentes: (11)-91234-5678 / (11)-3456-7890
export function telefone(v) {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)})-${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)})-${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function cep(v) {
  const d = soDigitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Data de nascimento dd/mm/aaaa; vazia = 01/01/1900 (padrao do SantSystem)
export function nascimento(v) {
  const t = String(v ?? '').trim();
  return /^\d{2}\/\d{2}\/\d{4}$/.test(t) ? t : '01/01/1900';
}

// Mesma placa no outro formato: antigo <-> Mercosul (5o caractere 0-9 <-> A-J)
export function placaAlternativa(so) {
  if (!/^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$/.test(so)) return null;
  const c = so[4];
  const troca = /[0-9]/.test(c) ? 'ABCDEFGHIJ'[Number(c)] : String('ABCDEFGHIJ'.indexOf(c));
  return so.slice(0, 4) + troca + so.slice(5);
}
