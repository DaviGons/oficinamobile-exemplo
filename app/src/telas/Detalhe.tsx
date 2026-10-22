import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { api, OS } from '../api';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BuscaCliente from '../BuscaCliente';
import CalculoCusto from '../CalculoCusto';
import { Nav } from '../nav';
import { compartilharPdfDaOS } from '../pdf';
import SeletorVeiculo, { tratarModeloNovo } from '../SeletorVeiculo';
import {
  Aviso, Botao, Campo, Cartao, Carregando, cor, dataBR, estilos, moeda, numeroDigitado, numeroParaCampo, Topo,
} from '../ui';

type Edicao =
  | { tipo: 'peca'; id: number; titulo: string; quantidade: string; valor: string; custo: string; descricao: string }
  | { tipo: 'servico'; id: number; titulo: string; quantidade: string; valor: string; custo: string; descricao: string }
  | { tipo: 'dados'; placa: string; marca: string; modelo: string; ano: string; cor: string; km: string; obs: string };

export default function Detalhe({ nav, id }: { nav: Nav; id: number }) {
  const [os, setOs] = useState<OS | null>(null);
  const [erro, setErro] = useState('');
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  async function gerarPdf() {
    setGerandoPdf(true);
    try {
      await compartilharPdfDaOS(id);
    } catch (e) {
      Alert.alert('Não foi possível gerar o PDF', (e as Error).message);
    } finally {
      setGerandoPdf(false);
    }
  }

  async function trocarCliente(clienteId: number) {
    try {
      await api(`/os/${id}`, { metodo: 'PATCH', corpo: { clienteId } });
      setEscolhendoCliente(false);
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível trocar o cliente', (e as Error).message);
    }
  }

  // Recarrega a OS sempre que a versao muda (depois de salvar algo)
  const [versao, setVersao] = useState(0);
  const carregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let ativo = true;
    api<OS>(`/os/${id}`)
      .then((o) => { if (ativo) { setOs(o); setErro(''); } })
      .catch((e) => { if (ativo) setErro((e as Error).message); });
    return () => { ativo = false; };
  }, [id, versao]);

  const editavel = os && !os.finalizada && !os.excluida;

  async function salvarEdicao() {
    if (!edicao) return;
    setSalvando(true);
    try {
      if (edicao.tipo === 'dados') {
        const { tipo: _t, ...dados } = edicao;
        await api(`/os/${id}`, { metodo: 'PATCH', corpo: dados });
      } else {
        const quantidade = numeroDigitado(edicao.quantidade);
        const valorUnitario = numeroDigitado(edicao.valor);
        const custo = numeroDigitado(edicao.custo);
        if (!(quantidade > 0) || !(valorUnitario >= 0) || !(custo >= 0)) throw new Error('Confira quantidade, valor e custo');
        const rota = edicao.tipo === 'peca' ? 'pecas' : 'servicos';
        await api(`/os/${id}/${rota}/${edicao.id}`, {
          metodo: 'PATCH', corpo: { quantidade, valorUnitario, custo, descricao: edicao.descricao },
        });
      }
      setEdicao(null);
      await carregar();
    } catch (e) {
      if (tratarModeloNovo(e, salvarEdicao)) return;
      Alert.alert('Não foi possível salvar', (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // Tira a peca/servico da OS do mesmo jeito que o SantSystem (a linha fica marcada como excluida)
  function removerItem() {
    if (!edicao || edicao.tipo === 'dados') return;
    const item = edicao;
    const oQue = item.tipo === 'peca' ? 'a peça' : 'o serviço';
    Alert.alert(`Remover ${oQue}?`, item.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          setSalvando(true);
          try {
            await api(`/os/${id}/${item.tipo === 'peca' ? 'pecas' : 'servicos'}/${item.id}`, { metodo: 'DELETE' });
            setEdicao(null);
            carregar();
          } catch (e) {
            Alert.alert(`Não foi possível remover ${oQue}`, (e as Error).message);
          } finally {
            setSalvando(false);
          }
        },
      },
    ]);
  }

  function excluir() {
    Alert.alert(`Excluir a OS ${id}?`, 'Ela some da lista, como a exclusão do SantSystem.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          try {
            await api(`/os/${id}`, { metodo: 'DELETE' });
            nav.voltar();
          } catch (e) {
            Alert.alert('Não foi possível excluir', (e as Error).message);
          }
        },
      },
    ]);
  }

  if (!os) {
    return (
      <>
        <Topo titulo={`OS ${id}`} aoVoltar={nav.voltar} />
        {erro ? <View style={{ padding: 16 }}><Aviso texto={erro} /><Botao titulo="Tentar de novo" aoTocar={carregar} /></View> : <Carregando />}
      </>
    );
  }

  return (
    <>
      <Topo titulo={`OS ${os.id}`} aoVoltar={nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {os.finalizada ? <Aviso tipo="info" texto={`Finalizada em ${dataBR(os.fim)}. Só leitura no app.`} /> : null}
        {erro ? <Aviso texto={erro} /> : null}

        <Cartao aoTocar={editavel ? () => setEscolhendoCliente(true) : undefined}>
          <Text style={estilos.suave}>CLIENTE</Text>
          <Text style={[estilos.titulo, { marginTop: 2 }]}>
            {os.clienteId ? (os.cliente ?? `Cliente ${os.clienteId}`) : 'Sem cliente'}
          </Text>
          {editavel ? (
            <Text style={[estilos.suave, { color: cor.azul, marginTop: 4 }]}>
              {os.clienteId ? 'Trocar cliente' : 'Definir cliente'}
            </Text>
          ) : null}
        </Cartao>

        <Cartao
          aoTocar={editavel ? () => setEdicao({
            tipo: 'dados', placa: os.placa, marca: os.marca, modelo: os.modelo, ano: os.ano, cor: os.cor, km: os.km, obs: os.obs,
          }) : undefined}
        >
          <Text style={estilos.titulo}>
            {os.placa || 'sem placa'}  ·  {[os.marca, os.modelo, os.ano, os.cor].filter(Boolean).join(' ')}
          </Text>
          <Text style={estilos.suave}>KM {os.km || '—'}  ·  aberta em {dataBR(os.abertura)}</Text>
          {os.obs ? <Text style={[estilos.suave, { marginTop: 6 }]}>Obs: {os.obs}</Text> : null}
          {editavel ? <Text style={[estilos.suave, { color: cor.azul, marginTop: 6 }]}>Tocar para editar</Text> : null}
        </Cartao>

        <Text style={estilos.secao}>PEÇAS · {moeda(os.totalPecas)}</Text>
        {os.pecas.length === 0 ? <Text style={estilos.suave}>Nenhuma peça</Text> : null}
        {os.pecas.map((p) => (
          <Cartao
            key={p.id}
            aoTocar={editavel ? () => setEdicao({
              tipo: 'peca', id: p.id, titulo: p.descricao, descricao: p.descricao,
              quantidade: numeroParaCampo(p.quantidade), valor: numeroParaCampo(p.valorUnitario), custo: numeroParaCampo(p.custo),
            }) : undefined}
          >
            <View style={estilos.linha}>
              <Text style={[estilos.texto, estilos.meio]} numberOfLines={2}>{p.descricao}</Text>
              <Text style={estilos.titulo}>{moeda(p.subtotal)}</Text>
            </View>
            <Text style={estilos.suave}>
              cód {p.codigo}  ·  {numeroParaCampo(p.quantidade)} {p.unidade} × {moeda(p.valorUnitario)}
            </Text>
          </Cartao>
        ))}
        {editavel ? <Botao titulo="+ Peça" tipo="secundario" aoTocar={() => nav.ir({ tela: 'peca', osId: os.id })} /> : null}

        <Text style={estilos.secao}>SERVIÇOS · {moeda(os.totalServicos)}</Text>
        {os.servicos.length === 0 ? <Text style={estilos.suave}>Nenhum serviço</Text> : null}
        {os.servicos.map((s) => (
          <Cartao
            key={s.id}
            aoTocar={editavel ? () => setEdicao({
              tipo: 'servico', id: s.id, titulo: s.descricao, descricao: s.descricao,
              quantidade: numeroParaCampo(s.quantidade), valor: numeroParaCampo(s.valorUnitario), custo: numeroParaCampo(s.custo),
            }) : undefined}
          >
            <View style={estilos.linha}>
              <Text style={[estilos.texto, estilos.meio]} numberOfLines={2}>{s.descricao}</Text>
              <Text style={estilos.titulo}>{moeda(s.subtotal)}</Text>
            </View>
            <Text style={estilos.suave}>{numeroParaCampo(s.quantidade)} × {moeda(s.valorUnitario)}</Text>
          </Cartao>
        ))}
        {editavel ? <Botao titulo="+ Serviço" tipo="secundario" aoTocar={() => nav.ir({ tela: 'servico', osId: os.id })} /> : null}

        <Cartao>
          <View style={estilos.linha}>
            <Text style={[estilos.titulo, estilos.meio]}>Total</Text>
            <Text style={[estilos.titulo, { fontSize: 22, color: cor.verde }]}>{moeda(os.total)}</Text>
          </View>
        </Cartao>

        <Botao titulo="Gerar PDF" aoTocar={gerarPdf} ocupado={gerandoPdf} />
        {editavel ? <Botao titulo="Excluir OS" tipo="perigo" aoTocar={excluir} /> : null}
      </ScrollView>

      <Modal visible={escolhendoCliente} animationType="slide" onRequestClose={() => setEscolhendoCliente(false)}>
        <SafeAreaProvider>
        <SafeAreaView style={estilos.tela}>
          <Topo titulo="Cliente da OS" aoVoltar={() => setEscolhendoCliente(false)} />
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            <BuscaCliente
              aoEscolher={(c) => trocarCliente(c.id)}
              aoSemCliente={os.clienteId ? () => trocarCliente(0) : undefined}
            />
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={!!edicao} transparent animationType="slide" onRequestClose={() => setEdicao(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: cor.fundo, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: cor.borda }}>
            <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
              {edicao?.tipo === 'dados' ? (
                <>
                  <Text style={[estilos.titulo, { marginBottom: 12 }]}>Dados da OS</Text>
                  <Campo rotulo="Placa" value={edicao.placa} autoCapitalize="characters"
                    onChangeText={(v) => setEdicao({ ...edicao, placa: v })} />
                  <SeletorVeiculo marca={edicao.marca} modelo={edicao.modelo}
                    aoMudar={(v) => setEdicao({ ...edicao, ...v })} />
                  <Campo rotulo="Ano" value={edicao.ano} keyboardType="number-pad"
                    onChangeText={(v) => setEdicao({ ...edicao, ano: v })} />
                  <Campo rotulo="Cor" value={edicao.cor} autoCapitalize="characters"
                    onChangeText={(v) => setEdicao({ ...edicao, cor: v })} />
                  <Campo rotulo="KM" value={edicao.km} keyboardType="number-pad"
                    onChangeText={(v) => setEdicao({ ...edicao, km: v })} />
                  <Campo rotulo="Observação" value={edicao.obs} multiline
                    onChangeText={(v) => setEdicao({ ...edicao, obs: v })} />
                </>
              ) : edicao ? (
                <>
                  <Text style={[estilos.titulo, { marginBottom: 12 }]} numberOfLines={2}>{edicao.titulo}</Text>
                  <Campo rotulo="Descrição" value={edicao.descricao}
                    onChangeText={(v) => setEdicao({ ...edicao, descricao: v })} />
                  <Campo rotulo="Quantidade" value={edicao.quantidade} keyboardType="decimal-pad"
                    onChangeText={(v) => setEdicao({ ...edicao, quantidade: v })} />
                  {edicao.tipo === 'peca' ? (
                    <CalculoCusto
                      quantidade={edicao.quantidade}
                      aoCalcular={({ valor, custo }) => setEdicao((e) => (e && e.tipo === 'peca' ? { ...e, valor, custo } : e))}
                    />
                  ) : null}
                  <Campo rotulo="Valor unitário (R$)" value={edicao.valor} keyboardType="decimal-pad"
                    onChangeText={(v) => setEdicao({ ...edicao, valor: v })} />
                  <Campo rotulo="Custo total (R$)" value={edicao.custo} keyboardType="decimal-pad"
                    onChangeText={(v) => setEdicao({ ...edicao, custo: v })} />
                </>
              ) : null}
              <Botao titulo="Salvar" aoTocar={salvarEdicao} ocupado={salvando} />
              <Botao titulo="Cancelar" tipo="secundario" aoTocar={() => setEdicao(null)} />
              {edicao && edicao.tipo !== 'dados' ? (
                <Botao titulo={edicao.tipo === 'peca' ? 'Remover peça' : 'Remover serviço'} tipo="perigo"
                  aoTocar={removerItem} desativado={salvando} />
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
