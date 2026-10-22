import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api, Veiculo } from '../api';
import BuscaCliente from '../BuscaCliente';
import { Nav } from '../nav';
import SeletorVeiculo, { tratarModeloNovo } from '../SeletorVeiculo';
import { Botao, Campo, Cartao, Carregando, cor, dataBR, estilos, Topo } from '../ui';

const VAZIO = { placa: '', marca: '', modelo: '', ano: '', cor: '', km: '', obs: '' };

type ClienteDaPlaca = { id: number; nome: string; ultimaOS: number; data: string | null };
type ResultadoPlaca = {
  veiculo: (Omit<Veiculo, 'km'> & { placaAnterior: string | null; atendimentos: number }) | null;
  clientes: ClienteDaPlaca[];
};
type ClienteEscolhido = { id: number; nome: string } | null;

const soPlaca = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Fluxo: placa primeiro. Placa conhecida puxa o carro e o cliente (KM em branco);
// placa nova deixa tudo em branco, inclusive o cliente (o SantSystem aceita OS sem cliente).
export default function NovaOS({ nav }: { nav: Nav }) {
  const [etapa, setEtapa] = useState<'placa' | 'cliente' | 'dados'>('placa');
  const [placaDigitada, setPlacaDigitada] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPlaca | null>(null);
  const [cliente, setCliente] = useState<ClienteEscolhido>(null);
  const [veiculosDoCliente, setVeiculosDoCliente] = useState<Veiculo[]>([]);
  const [dados, setDados] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  async function buscarPlaca(texto = placaDigitada) {
    const so = soPlaca(texto);
    if (so.length !== 7) return Alert.alert('Digite a placa completa (7 caracteres)');
    setBuscando(true);
    try {
      const r = await api<ResultadoPlaca>(`/veiculos/${so}`);
      setResultado(r);
      setVeiculosDoCliente([]);
      if (r.veiculo) {
        const v = r.veiculo;
        setDados({ ...VAZIO, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, cor: v.cor });
        setCliente(r.clientes[0] ? { id: r.clientes[0].id, nome: r.clientes[0].nome } : null);
      } else {
        setDados({ ...VAZIO, placa: so });
        setCliente(null);
      }
      setEtapa('dados');
    } catch (e) {
      Alert.alert('Não foi possível buscar a placa', (e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  // Busca sozinha quando a placa fica completa
  function mudarPlaca(v: string) {
    setPlacaDigitada(v);
    if (soPlaca(v).length === 7 && soPlaca(v) !== soPlaca(placaDigitada)) buscarPlaca(v);
  }

  async function escolherCliente(c: { id: number; nome: string }) {
    setCliente(c);
    setEtapa('dados');
    // Sem placa informada: sugere os carros que esse cliente ja trouxe
    if (!resultado) {
      try {
        setVeiculosDoCliente(await api<Veiculo[]>(`/clientes/${c.id}/veiculos`));
      } catch {
        setVeiculosDoCliente([]);
      }
    }
  }

  async function abrir() {
    setSalvando(true);
    try {
      const { id } = await api<{ id: number }>('/os', {
        metodo: 'POST',
        corpo: { clienteId: cliente?.id ?? 0, ...dados },
      });
      nav.trocar({ tela: 'os', id });
    } catch (e) {
      if (tratarModeloNovo(e, abrir)) return;
      Alert.alert('Não foi possível abrir a OS', (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (chave: keyof typeof VAZIO, rotulo: string, extra: object = {}) => (
    <Campo rotulo={rotulo} value={dados[chave]} onChangeText={(v) => setDados({ ...dados, [chave]: v })} {...extra} />
  );

  if (etapa === 'placa') {
    return (
      <>
        <Topo titulo="Nova OS" aoVoltar={nav.voltar} />
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Campo
            rotulo="Placa do veículo"
            value={placaDigitada}
            onChangeText={mudarPlaca}
            placeholder="ABC1D23"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={8}
            style={{ fontSize: 28, fontWeight: '700', letterSpacing: 3, textAlign: 'center' }}
          />
          {buscando ? <Carregando /> : <Botao titulo="Buscar placa" aoTocar={() => buscarPlaca()} />}
          <View style={{ height: 24 }} />
          <Botao
            titulo="Sem placa: buscar pelo cliente"
            tipo="secundario"
            aoTocar={() => { setResultado(null); setDados(VAZIO); setEtapa('cliente'); }}
          />
        </ScrollView>
      </>
    );
  }

  if (etapa === 'cliente') {
    return (
      <>
        <Topo titulo="Escolher cliente" aoVoltar={() => setEtapa(resultado || dados.placa ? 'dados' : 'placa')} />
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <BuscaCliente
            aoEscolher={escolherCliente}
            aoSemCliente={() => { setCliente(null); setEtapa('dados'); }}
          />
        </ScrollView>
      </>
    );
  }

  const outros = (resultado?.clientes ?? []).filter((c) => c.id !== cliente?.id);

  return (
    <>
      <Topo titulo="Nova OS" aoVoltar={() => setEtapa('placa')} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {resultado?.veiculo ? (
          <Text style={[estilos.suave, { marginBottom: 10 }]}>
            Carro já atendido {resultado.veiculo.atendimentos}x
            {resultado.veiculo.placaAnterior ? ` (também como ${resultado.veiculo.placaAnterior})` : ''}.
          </Text>
        ) : resultado ? (
          <Text style={[estilos.suave, { marginBottom: 10 }]}>Placa nova: preencha o que souber.</Text>
        ) : null}

        <Cartao aoTocar={() => setEtapa('cliente')}>
          <Text style={estilos.suave}>CLIENTE</Text>
          <Text style={[estilos.titulo, { marginTop: 2 }]}>{cliente ? cliente.nome : 'Sem cliente (fica em branco)'}</Text>
          <Text style={[estilos.suave, { color: cor.azul, marginTop: 4 }]}>
            {cliente ? 'Trocar cliente' : 'Escolher ou cadastrar cliente'}
          </Text>
        </Cartao>
        {outros.length ? (
          <>
            <Text style={estilos.suave}>Esse carro também já veio com:</Text>
            <View style={[estilos.linha, { flexWrap: 'wrap', marginVertical: 8 }]}>
              {outros.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCliente({ id: c.id, nome: c.nome })}
                  style={{ borderWidth: 1, borderRadius: 8, padding: 10, borderColor: cor.borda }}
                >
                  <Text style={estilos.texto}>{c.nome}</Text>
                  <Text style={estilos.suave}>OS {c.ultimaOS} · {dataBR(c.data)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {veiculosDoCliente.length ? <Text style={estilos.secao}>VEÍCULOS JÁ ATENDIDOS</Text> : null}
        <View style={[estilos.linha, { flexWrap: 'wrap' }]}>
          {veiculosDoCliente.map((v) => (
            <Pressable
              key={v.placa}
              onPress={() => setDados({ ...dados, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, cor: v.cor, km: '' })}
              style={{ borderWidth: 1, borderRadius: 8, padding: 10, borderColor: dados.placa === v.placa ? cor.azul : cor.borda }}
            >
              <Text style={estilos.texto}>{v.placa}</Text>
              <Text style={estilos.suave}>{v.modelo}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={estilos.secao}>VEÍCULO</Text>
        {campo('placa', 'Placa', { autoCapitalize: 'characters' })}
        <SeletorVeiculo marca={dados.marca} modelo={dados.modelo} aoMudar={(v) => setDados({ ...dados, ...v })} />
        {campo('ano', 'Ano', { keyboardType: 'number-pad' })}
        {campo('cor', 'Cor', { autoCapitalize: 'characters' })}
        {campo('km', 'KM atual', { keyboardType: 'number-pad' })}
        {campo('obs', 'Observação', { multiline: true })}
        <Botao titulo="Abrir OS" aoTocar={abrir} ocupado={salvando} />
      </ScrollView>
    </>
  );
}
