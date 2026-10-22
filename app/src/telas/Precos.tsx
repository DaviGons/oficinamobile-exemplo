import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, Peca, Servico } from '../api';
import { Nav } from '../nav';
import { Aviso, Campo, Cartao, Carregando, cor, estilos, moeda, numeroParaCampo, Topo } from '../ui';

// So consulta: preco de tabela, custo e estoque das pecas, e o valor dos servicos
export default function Precos({ nav }: { nav: Nav }) {
  const [tipo, setTipo] = useState<'peca' | 'servico'>('peca');
  const [busca, setBusca] = useState('');
  const [pecasEncontradas, setPecasEncontradas] = useState<Peca[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  // Pecas so aparecem com algo digitado (o catalogo e grande); servicos listam todos
  const pecas = busca.trim() ? pecasEncontradas : [];

  useEffect(() => {
    const termo = busca.trim();
    if (tipo === 'peca' && !termo) return;
    let ativo = true;
    const t = setTimeout(async () => {
      setCarregando(true);
      try {
        const q = encodeURIComponent(termo);
        if (tipo === 'peca') {
          const l = await api<Peca[]>(`/pecas?busca=${q}`);
          if (ativo) setPecasEncontradas(l);
        } else {
          const l = await api<Servico[]>(`/servicos?busca=${q}`);
          if (ativo) setServicos(l);
        }
        if (ativo) setErro('');
      } catch (e) {
        if (ativo) setErro((e as Error).message);
      } finally {
        if (ativo) setCarregando(false);
      }
    }, 350);
    return () => { ativo = false; clearTimeout(t); };
  }, [busca, tipo]);

  return (
    <>
      <Topo titulo="Consultar preços" aoVoltar={nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={[estilos.linha, { marginBottom: 12 }]}>
          {(['peca', 'servico'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTipo(t)}
              style={{
                flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
                backgroundColor: tipo === t ? cor.azul : cor.cartao,
              }}
            >
              <Text style={{ color: cor.texto, fontWeight: '600' }}>{t === 'peca' ? 'Peças' : 'Serviços'}</Text>
            </Pressable>
          ))}
        </View>
        <Campo
          value={busca}
          onChangeText={setBusca}
          placeholder={tipo === 'peca' ? 'Código ou descrição da peça' : 'Filtrar serviços'}
          autoFocus
          autoCapitalize="characters"
        />
        {erro ? <Aviso texto={erro} /> : null}
        {carregando ? <Carregando /> : null}
        {!carregando && tipo === 'peca' && busca.trim() && !pecas.length && !erro ? (
          <Text style={estilos.suave}>Nenhuma peça encontrada</Text>
        ) : null}

        {tipo === 'peca'
          ? pecas.map((p) => (
            <Cartao key={p.icps}>
              <Text style={estilos.texto} numberOfLines={3}>{p.descricao}</Text>
              <View style={[estilos.linha, { marginTop: 8 }]}>
                <View style={estilos.meio}>
                  <Text style={estilos.suave}>Venda</Text>
                  <Text style={[estilos.titulo, { color: cor.verde, fontSize: 20 }]}>{moeda(p.preco)}</Text>
                </View>
                <View style={estilos.meio}>
                  <Text style={estilos.suave}>Custo</Text>
                  <Text style={estilos.titulo}>{moeda(p.custo)}</Text>
                </View>
                <View style={estilos.meio}>
                  <Text style={estilos.suave}>Estoque</Text>
                  <Text style={[estilos.titulo, p.estoque <= 0 && { color: cor.amarelo }]}>
                    {numeroParaCampo(p.estoque)} {p.unidade}
                  </Text>
                </View>
              </View>
              <Text style={[estilos.suave, { marginTop: 6 }]}>cód {p.codigo}</Text>
            </Cartao>
          ))
          : servicos.map((s) => (
            <Cartao key={s.id}>
              <View style={estilos.linha}>
                <Text style={[estilos.texto, estilos.meio]} numberOfLines={2}>{s.descricao}</Text>
                <Text style={[estilos.titulo, { color: cor.verde }]}>{moeda(s.valor)}</Text>
              </View>
              <Text style={estilos.suave}>cód {s.codigo}{s.custo ? `  ·  custo ${moeda(s.custo)}` : ''}</Text>
            </Cartao>
          ))}
      </ScrollView>
    </>
  );
}
