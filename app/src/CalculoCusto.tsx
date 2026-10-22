import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useEffectEvent, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { cor, estilos, moeda, numeroDigitado, numeroParaCampo } from './ui';

const CHAVE = 'santsystem:ultimo-calculo';

// Custo = preco seco - nosso desconto; venda = custo + margem (margem sobre o
// custo, igual ao campo Marg do SantSystem: 124,81 -> 188,00 = 50,63%)
export function calcular(seco: number, desconto: number, margem: number) {
  const custo = seco * (1 - desconto / 100);
  return { custo, venda: Math.round(custo * (1 + margem / 100) * 100) / 100 };
}

export default function CalculoCusto({
  quantidade, aoCalcular,
}: {
  quantidade: string;
  aoCalcular: (valores: { valor: string; custo: string }) => void;
}) {
  const [seco, setSeco] = useState('');
  const [desconto, setDesconto] = useState('');
  const [margem, setMargem] = useState('');
  const avisar = useEffectEvent((valores: { valor: string; custo: string }) => aoCalcular(valores));

  // Desconto e margem da ultima peca ja vem preenchidos
  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((t) => {
        if (!t) return;
        const ultimo = JSON.parse(t) as { desconto: string; margem: string };
        setDesconto((d) => d || ultimo.desconto);
        setMargem((m) => m || ultimo.margem);
      })
      .catch(() => {});
  }, []);

  const s = numeroDigitado(seco);
  const d = numeroDigitado(desconto || '0');
  const m = numeroDigitado(margem || '0');
  const q = numeroDigitado(quantidade);
  const valido = s > 0 && d >= 0 && d < 100 && m >= 0;
  const r = valido ? calcular(s, d, m) : null;

  // Repassa o calculo para o formulario (valor unitario e custo total) quando muda algo
  useEffect(() => {
    if (!(s > 0 && d >= 0 && d < 100 && m >= 0 && q > 0)) return;
    const calc = calcular(s, d, m);
    avisar({ valor: numeroParaCampo(calc.venda), custo: numeroParaCampo(Math.round(calc.custo * q * 100) / 100) });
    AsyncStorage.setItem(CHAVE, JSON.stringify({ desconto, margem })).catch(() => {});
  }, [s, d, m, q, desconto, margem]);

  const campo = (rotulo: string, valor: string, mudar: (v: string) => void, sufixo: string) => (
    <View style={{ flex: 1 }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <View style={[estilos.campo, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
        <TextInput
          value={valor}
          onChangeText={mudar}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={cor.suave}
          style={{ flex: 1, color: cor.texto, fontSize: 16, paddingVertical: 12 }}
        />
        <Text style={estilos.suave}>{sufixo}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ borderWidth: 1, borderColor: cor.borda, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <Text style={[estilos.secao, { marginTop: 0 }]}>CUSTOS</Text>
      {campo('Preço seco', seco, setSeco, 'R$')}
      <View style={[estilos.linha, { marginTop: 10 }]}>
        {campo('Nosso desconto', desconto, setDesconto, '%')}
        {campo('Margem', margem, setMargem, '%')}
      </View>
      <Text style={[estilos.suave, { marginTop: 10 }]}>
        {r
          ? `Custo ${moeda(r.custo)}  →  venda ${moeda(r.venda)} (valor unitário e custo preenchidos abaixo)`
          : 'Preencha o preço seco para calcular o valor de venda.'}
      </Text>
    </View>
  );
}
