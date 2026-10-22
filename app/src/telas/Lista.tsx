import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { api, configAtual, ResumoOS } from '../api';
import { Nav } from '../nav';
import { Aviso, Botao, Cartao, cor, dataBR, estilos, moeda, Topo } from '../ui';

// Mantem a busca ao voltar de uma OS
let buscaGuardada = '';
let situacaoGuardada: 'abertas' | 'finalizadas' = 'abertas';

export default function Lista({ nav }: { nav: Nav }) {
  const [busca, setBusca] = useState(buscaGuardada);
  const [situacao, setSituacao] = useState(situacaoGuardada);
  const [lista, setLista] = useState<ResumoOS[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const q = new URLSearchParams({ situacao, busca: busca.trim() });
      setLista(await api<ResumoOS[]>(`/os?${q}`));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [busca, situacao]);

  useEffect(() => {
    buscaGuardada = busca;
    situacaoGuardada = situacao;
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca, situacao]);

  return (
    <>
      <Topo
        titulo="Ordens de serviço"
        direita={
          <View style={[estilos.linha, { gap: 16 }]}>
            <Pressable onPress={() => nav.ir({ tela: 'precos' })} hitSlop={12}>
              <Text style={{ color: cor.azul, fontSize: 14, fontWeight: '600' }}>Preços</Text>
            </Pressable>
            <Pressable onPress={() => nav.ir({ tela: 'clientes' })} hitSlop={12}>
              <Text style={{ color: cor.azul, fontSize: 14, fontWeight: '600' }}>Clientes</Text>
            </Pressable>
            <Pressable onPress={() => nav.ir({ tela: 'config' })} hitSlop={12}>
              <Text style={{ color: cor.suave, fontSize: 14 }}>{configAtual()?.funcionarioNome?.split(' ')[0]} ⚙</Text>
            </Pressable>
          </View>
        }
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar placa, cliente ou nº da OS"
          placeholderTextColor={cor.suave}
          autoCapitalize="characters"
          style={estilos.campo}
        />
        <View style={[estilos.linha, { marginTop: 10 }]}>
          {(['abertas', 'finalizadas'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSituacao(s)}
              style={{
                flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
                backgroundColor: situacao === s ? cor.azul : cor.cartao,
              }}
            >
              <Text style={{ color: cor.texto, fontWeight: '600' }}>{s === 'abertas' ? 'Abertas' : 'Finalizadas'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {erro ? <View style={{ padding: 16 }}><Aviso texto={erro} /></View> : null}
      <FlatList
        data={lista}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor={cor.azul} />}
        ListEmptyComponent={carregando ? null : <Text style={[estilos.suave, { textAlign: 'center' }]}>Nenhuma OS</Text>}
        renderItem={({ item: o }) => (
          <Cartao aoTocar={() => nav.ir({ tela: 'os', id: o.id })}>
            <View style={estilos.linha}>
              <Text style={[estilos.titulo, { color: cor.azul }]}>#{o.id}</Text>
              <Text style={[estilos.titulo, estilos.meio]}>{o.placa || 'sem placa'}</Text>
              <Text style={estilos.titulo}>{moeda(o.total)}</Text>
            </View>
            <Text style={[estilos.texto, { marginTop: 4 }]} numberOfLines={1}>{o.clienteId ? (o.cliente ?? `Cliente ${o.clienteId}`) : 'Sem cliente'}</Text>
            <Text style={estilos.suave} numberOfLines={1}>
              {[o.marca, o.modelo, o.ano].filter(Boolean).join(' · ')}
              {o.abertura ? `  —  ${dataBR(o.abertura)}` : ''}
            </Text>
          </Cartao>
        )}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Botao titulo="+ Nova OS" aoTocar={() => nav.ir({ tela: 'nova' })} />
      </View>
    </>
  );
}
