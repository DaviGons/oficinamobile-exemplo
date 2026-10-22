import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, ErroApi, Marca, Modelo } from './api';
import { Botao, Campo, Cartao, Carregando, cor, estilos, Topo } from './ui';

// Mesmo jeito de comparar da API: maiusculas, sem acento e sem pontuacao
const chave = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[^A-Z0-9!]+/g, ' ').trim();

// Guardadas enquanto o app esta aberto: a lista de marcas quase nao muda
let marcasGuardadas: Marca[] | null = null;

type Props = {
  marca: string;
  modelo: string;
  aoMudar: (v: { marca: string; modelo: string }) => void;
};

// Marca e modelo escolhidos das listas do SantSystem: digitar "GM" deixava a OS
// sem marca no SantSystem, que so mostra "CHEVROLET (GM)"
export default function SeletorVeiculo({ marca, modelo, aoMudar }: Props) {
  const [abrindo, setAbrindo] = useState<'marca' | 'modelo' | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>(marcasGuardadas ?? []);
  // Modelos carregados e de qual marca sao
  const [carga, setCarga] = useState<{ de: number; lista: Modelo[] } | null>(null);
  const [filtro, setFiltro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);

  const marcaAtual = marcas.find((m) => chave(m.marca) === chave(marca));
  const marcaId = marcaAtual?.id;
  const modelosCarregados = marcaId !== undefined && carga?.de === marcaId;
  const modelos = modelosCarregados ? carga.lista : [];
  const marcaValida = !marca || !!marcaAtual || !marcas.length;
  // So avisa depois de carregar os modelos da marca escolhida
  const modeloValido = !modelo || !modelosCarregados || modelos.some((m) => chave(m.modelo) === chave(modelo));

  useEffect(() => {
    if (marcasGuardadas) return;
    api<Marca[]>('/veiculos/marcas')
      .then((l) => { marcasGuardadas = l; setMarcas(l); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (marcaId === undefined) return;
    let ativo = true;
    api<Modelo[]>(`/veiculos/marcas/${marcaId}/modelos`)
      .then((lista) => { if (ativo) setCarga({ de: marcaId, lista }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [marcaId]);

  async function abrir(qual: 'marca' | 'modelo') {
    if (qual === 'modelo' && !marcaAtual) return Alert.alert('Escolha a marca primeiro');
    setFiltro('');
    setAbrindo(qual);
    if (qual === 'marca' && !marcas.length) {
      setCarregando(true);
      try {
        const l = await api<Marca[]>('/veiculos/marcas');
        marcasGuardadas = l;
        setMarcas(l);
      } catch (e) {
        Alert.alert('Não foi possível carregar as marcas', (e as Error).message);
      } finally {
        setCarregando(false);
      }
    }
  }

  async function cadastrarModelo() {
    if (!marcaAtual) return;
    const nome = filtro.trim().toUpperCase();
    setCadastrando(true);
    try {
      const novo = await api<{ id: number; modelo: string }>('/veiculos/modelos', {
        metodo: 'POST', corpo: { marca: marcaAtual.marca, modelo: nome },
      });
      setCarga((c) => (c ? {
        ...c, lista: [...c.lista, { id: novo.id, modelo: novo.modelo }].sort((a, b) => a.modelo.localeCompare(b.modelo)),
      } : c));
      aoMudar({ marca: marcaAtual.marca, modelo: novo.modelo });
      setAbrindo(null);
    } catch (e) {
      Alert.alert('Não foi possível cadastrar o modelo', (e as Error).message);
    } finally {
      setCadastrando(false);
    }
  }

  const f = chave(filtro);
  const opcoes = abrindo === 'marca'
    ? marcas.map((m) => m.marca).filter((m) => chave(m).includes(f))
    : modelos.map((m) => m.modelo).filter((m) => chave(m).includes(f));
  const modeloNovo = abrindo === 'modelo' && f && !modelos.some((m) => chave(m.modelo) === f);

  return (
    <>
      <Seletor rotulo="Marca" valor={marca} invalido={!marcaValida} aoTocar={() => abrir('marca')} />
      <Seletor rotulo="Modelo" valor={modelo} invalido={!modeloValido} aoTocar={() => abrir('modelo')} />

      <Modal visible={!!abrindo} animationType="slide" onRequestClose={() => setAbrindo(null)}>
        <SafeAreaProvider>
          <SafeAreaView style={estilos.tela}>
            <Topo titulo={abrindo === 'marca' ? 'Marca' : `Modelo · ${marcaAtual?.marca ?? ''}`} aoVoltar={() => setAbrindo(null)} />
            <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
              <Campo value={filtro} onChangeText={setFiltro} placeholder="Filtrar" autoFocus autoCapitalize="characters" />
              {carregando ? <Carregando /> : null}
              {modeloNovo ? (
                <Botao
                  titulo={`Cadastrar "${filtro.trim().toUpperCase()}" na ${marcaAtual?.marca}`}
                  tipo="secundario" aoTocar={cadastrarModelo} ocupado={cadastrando}
                />
              ) : null}
              {abrindo === 'marca' && marca ? (
                <Cartao aoTocar={() => { aoMudar({ marca: '', modelo: '' }); setAbrindo(null); }}>
                  <Text style={estilos.suave}>Sem marca</Text>
                </Cartao>
              ) : null}
              {opcoes.map((o) => (
                <Cartao
                  key={o}
                  aoTocar={() => {
                    if (abrindo === 'marca') aoMudar({ marca: o, modelo: chave(o) === chave(marca) ? modelo : '' });
                    else aoMudar({ marca: marcaAtual?.marca ?? marca, modelo: o });
                    setAbrindo(null);
                  }}
                >
                  <Text style={[estilos.texto, chave(o) === chave(abrindo === 'marca' ? marca : modelo) && { color: cor.azul, fontWeight: '700' }]}>
                    {o}
                  </Text>
                </Cartao>
              ))}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

// Salvar a OS com um modelo que nao existe na marca (ex.: veio de uma OS antiga):
// pergunta se cadastra o modelo no SantSystem e, se sim, salva de novo
export function tratarModeloNovo(erro: unknown, repetir: () => void) {
  if (!(erro instanceof ErroApi) || erro.codigo !== 'modelo_novo') return false;
  const { marca, modelo } = erro.dados as { marca: string; modelo: string };
  Alert.alert('Modelo novo', `${erro.message}\n\nCadastrar "${modelo}" na ${marca}?`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Cadastrar',
      onPress: async () => {
        try {
          await api('/veiculos/modelos', { metodo: 'POST', corpo: { marca, modelo } });
          repetir();
        } catch (e) {
          Alert.alert('Não foi possível cadastrar o modelo', (e as Error).message);
        }
      },
    },
  ]);
  return true;
}

function Seletor({ rotulo, valor, invalido, aoTocar }: { rotulo: string; valor: string; invalido: boolean; aoTocar: () => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Pressable onPress={aoTocar} style={[estilos.campo, { flexDirection: 'row' }, invalido && { borderColor: cor.amarelo }]}>
        <Text style={[estilos.texto, estilos.meio, !valor && { color: cor.suave }]}>{valor || 'Escolher'}</Text>
        <Text style={{ color: cor.suave }}>▾</Text>
      </Pressable>
      {invalido ? (
        <Text style={[estilos.suave, { color: cor.amarelo, marginTop: 4 }]}>Não existe no SantSystem: escolha da lista</Text>
      ) : null}
    </View>
  );
}
