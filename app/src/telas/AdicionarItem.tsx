import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api, Peca, Servico } from '../api';
import CalculoCusto from '../CalculoCusto';
import { Nav } from '../nav';
import { Aviso, Botao, Campo, Cartao, cor, estilos, moeda, numeroDigitado, numeroParaCampo, Topo } from '../ui';

type Escolha = { descricao: string; quantidade: string; valor: string; custo: string };

// Uma tela para peca e servico: busca no catalogo, escolhe, ajusta e lanca
export default function AdicionarItem({ nav, osId, tipo }: { nav: Nav; osId: number; tipo: 'peca' | 'servico' }) {
  const [busca, setBusca] = useState('');
  const [pecasEncontradas, setPecasEncontradas] = useState<Peca[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [peca, setPeca] = useState<Peca | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Pecas so aparecem com algo digitado (o catalogo e grande); servicos listam todos
  const pecas = busca.trim() ? pecasEncontradas : [];

  useEffect(() => {
    if (tipo === 'peca' && !busca.trim()) return;
    const t = setTimeout(async () => {
      try {
        const q = encodeURIComponent(busca.trim());
        if (tipo === 'peca') setPecasEncontradas(await api<Peca[]>(`/pecas?busca=${q}`));
        else setServicos(await api<Servico[]>(`/servicos?busca=${q}`));
        setErro('');
      } catch (e) {
        setErro((e as Error).message);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [busca, tipo]);

  function escolherPeca(p: Peca) {
    setPeca(p);
    setEscolha({ descricao: p.descricao, quantidade: '1', valor: numeroParaCampo(p.preco), custo: '' });
  }

  function escolherServico(s: Servico) {
    setServico(s);
    setEscolha({ descricao: s.descricao, quantidade: '1', valor: numeroParaCampo(s.valor), custo: '0' });
  }

  async function lancar() {
    if (!escolha) return;
    const quantidade = numeroDigitado(escolha.quantidade);
    const valorUnitario = numeroDigitado(escolha.valor);
    if (!(quantidade > 0) || !(valorUnitario >= 0)) return Alert.alert('Confira quantidade e valor');
    setSalvando(true);
    try {
      if (tipo === 'peca' && peca) {
        const custo = escolha.custo.trim() ? numeroDigitado(escolha.custo) : undefined;
        if (custo !== undefined && !(custo >= 0)) return Alert.alert('Confira o custo');
        await api(`/os/${osId}/pecas`, {
          metodo: 'POST', corpo: { codigo: peca.codigo, quantidade, valorUnitario, custo, descricao: escolha.descricao },
        });
      } else if (servico) {
        const custo = numeroDigitado(escolha.custo || '0');
        await api(`/os/${osId}/servicos`, {
          metodo: 'POST',
          corpo: {
            servicoId: servico.id, quantidade, valorUnitario, descricao: escolha.descricao,
            custo: custo >= 0 ? custo : 0,
          },
        });
      }
      nav.voltar();
    } catch (e) {
      Alert.alert('Não foi possível lançar', (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = tipo === 'peca' ? 'Lançar peça' : 'Lançar serviço';

  if (escolha) {
    const total = numeroDigitado(escolha.quantidade) * numeroDigitado(escolha.valor);
    return (
      <>
        <Topo titulo={titulo} aoVoltar={() => { setEscolha(null); setPeca(null); setServico(null); }} />
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          {peca ? (
            <Text style={[estilos.suave, { marginBottom: 12 }]}>
              cód {peca.codigo} · estoque {numeroParaCampo(peca.estoque)} {peca.unidade} · tabela {moeda(peca.preco)}
            </Text>
          ) : null}
          <Campo rotulo="Descrição" value={escolha.descricao} onChangeText={(v) => setEscolha({ ...escolha, descricao: v })} />
          <Campo rotulo="Quantidade" value={escolha.quantidade} keyboardType="decimal-pad" autoFocus selectTextOnFocus
            onChangeText={(v) => setEscolha({ ...escolha, quantidade: v })} />
          {tipo === 'peca' ? (
            <CalculoCusto
              quantidade={escolha.quantidade}
              aoCalcular={({ valor, custo }) => setEscolha((e) => (e ? { ...e, valor, custo } : e))}
            />
          ) : null}
          <Campo rotulo="Valor unitário (R$)" value={escolha.valor} keyboardType="decimal-pad" selectTextOnFocus
            onChangeText={(v) => setEscolha({ ...escolha, valor: v })} />
          {tipo === 'peca' && peca ? (
            <Campo rotulo="Custo total (R$)" value={escolha.custo} keyboardType="decimal-pad" selectTextOnFocus
              placeholder={`${moeda(peca.custo * (numeroDigitado(escolha.quantidade) || 0))} (do cadastro)`}
              onChangeText={(v) => setEscolha({ ...escolha, custo: v })} />
          ) : null}
          {tipo === 'servico' ? (
            <Campo rotulo="Custo (R$, opcional)" value={escolha.custo} keyboardType="decimal-pad" selectTextOnFocus
              onChangeText={(v) => setEscolha({ ...escolha, custo: v })} />
          ) : null}
          <Cartao>
            <View style={estilos.linha}>
              <Text style={[estilos.texto, estilos.meio]}>Total do item</Text>
              <Text style={[estilos.titulo, { color: cor.verde }]}>{Number.isFinite(total) ? moeda(total) : '—'}</Text>
            </View>
          </Cartao>
          <Botao titulo="Lançar na OS" aoTocar={lancar} ocupado={salvando} />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Topo titulo={titulo} aoVoltar={nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Campo
          value={busca}
          onChangeText={setBusca}
          placeholder={tipo === 'peca' ? 'Código ou descrição da peça' : 'Filtrar serviços'}
          autoFocus
          autoCapitalize="characters"
        />
        {erro ? <Aviso texto={erro} /> : null}
        {tipo === 'peca'
          ? pecas.map((p) => (
            <Cartao key={p.icps} aoTocar={() => escolherPeca(p)}>
              <View style={estilos.linha}>
                <Text style={[estilos.texto, estilos.meio]} numberOfLines={2}>{p.descricao}</Text>
                <Text style={estilos.titulo}>{moeda(p.preco)}</Text>
              </View>
              <Text style={estilos.suave}>cód {p.codigo} · estoque {numeroParaCampo(p.estoque)} {p.unidade}</Text>
            </Cartao>
          ))
          : servicos.map((s) => (
            <Cartao key={s.id} aoTocar={() => escolherServico(s)}>
              <View style={estilos.linha}>
                <Text style={[estilos.texto, estilos.meio]} numberOfLines={2}>{s.descricao}</Text>
                <Text style={estilos.titulo}>{moeda(s.valor)}</Text>
              </View>
              <Text style={estilos.suave}>cód {s.codigo}</Text>
            </Cartao>
          ))}
      </ScrollView>
    </>
  );
}
