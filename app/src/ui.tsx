import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export const cor = {
  fundo: '#0b0d12',
  cartao: '#151922',
  borda: '#252b38',
  texto: '#e8ebf2',
  suave: '#8b93a7',
  azul: '#3b82f6',
  verde: '#22c55e',
  vermelho: '#ef4444',
  amarelo: '#eab308',
};

export function moeda(valor: number) {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}R$ ${milhar},${centavos}`;
}

export function numeroDigitado(texto: string) {
  const n = Number(texto.replace(/\./g, '').replace(',', '.').trim());
  return texto.trim() && Number.isFinite(n) ? n : NaN;
}

export function numeroParaCampo(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

export function dataBR(iso: string | null) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function Botao({
  titulo, aoTocar, tipo = 'primario', ocupado, desativado,
}: {
  titulo: string; aoTocar: () => void; tipo?: 'primario' | 'secundario' | 'perigo'; ocupado?: boolean; desativado?: boolean;
}) {
  const fundo = tipo === 'primario' ? cor.azul : tipo === 'perigo' ? 'transparent' : cor.cartao;
  return (
    <Pressable
      onPress={aoTocar}
      disabled={ocupado || desativado}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, opacity: pressed || desativado ? 0.6 : 1 },
        tipo !== 'primario' && { borderWidth: 1, borderColor: tipo === 'perigo' ? cor.vermelho : cor.borda },
      ]}
    >
      {ocupado ? (
        <ActivityIndicator color={cor.texto} />
      ) : (
        <Text style={[estilos.botaoTexto, tipo === 'perigo' && { color: cor.vermelho }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {rotulo ? <Text style={estilos.rotulo}>{rotulo}</Text> : null}
      <TextInput placeholderTextColor={cor.suave} {...props} style={[estilos.campo, style]} />
    </View>
  );
}

export function Cartao({ children, aoTocar }: { children: ReactNode; aoTocar?: () => void }) {
  if (!aoTocar) return <View style={estilos.cartao}>{children}</View>;
  return (
    <Pressable onPress={aoTocar} style={({ pressed }) => [estilos.cartao, pressed && { borderColor: cor.azul }]}>
      {children}
    </Pressable>
  );
}

export function Topo({ titulo, aoVoltar, direita }: { titulo: string; aoVoltar?: () => void; direita?: ReactNode }) {
  return (
    <View style={estilos.topo}>
      {aoVoltar ? (
        <Pressable onPress={aoVoltar} hitSlop={12} style={{ paddingRight: 14 }}>
          <Text style={{ color: cor.azul, fontSize: 28, lineHeight: 30 }}>‹</Text>
        </Pressable>
      ) : null}
      <Text style={estilos.topoTitulo} numberOfLines={1}>{titulo}</Text>
      {direita}
    </View>
  );
}

export function Aviso({ texto, tipo = 'erro' }: { texto: string; tipo?: 'erro' | 'info' }) {
  return (
    <View style={[estilos.aviso, { borderColor: tipo === 'erro' ? cor.vermelho : cor.azul }]}>
      <Text style={{ color: tipo === 'erro' ? cor.vermelho : cor.texto }}>{texto}</Text>
    </View>
  );
}

export function Carregando() {
  return <ActivityIndicator color={cor.azul} style={{ marginTop: 40 }} size="large" />;
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: 16, paddingBottom: 48 },
  topo: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: cor.borda,
  },
  topoTitulo: { color: cor.texto, fontSize: 20, fontWeight: '700', flex: 1 },
  botao: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginVertical: 6 },
  botaoTexto: { color: cor.texto, fontSize: 16, fontWeight: '600' },
  rotulo: { color: cor.suave, fontSize: 13, marginBottom: 6 },
  campo: {
    backgroundColor: cor.cartao, color: cor.texto, borderRadius: 10, borderWidth: 1, borderColor: cor.borda,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  cartao: {
    backgroundColor: cor.cartao, borderRadius: 12, borderWidth: 1, borderColor: cor.borda, padding: 14, marginBottom: 10,
  },
  aviso: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  titulo: { color: cor.texto, fontSize: 16, fontWeight: '700' },
  texto: { color: cor.texto, fontSize: 15 },
  suave: { color: cor.suave, fontSize: 13 },
  secao: { color: cor.suave, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8, letterSpacing: 0.5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meio: { flex: 1 },
});
