import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { api, ClienteCompleto } from './api';
import { Aviso, Botao, Campo, Carregando, cor, estilos } from './ui';

const VAZIO: ClienteCompleto = {
  tipo: 'F', nome: '', apelido: '', documento: '', rg: '', nascimento: '', celular: '', telefone: '', email: '',
  cep: '', tipoEndereco: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  codigoCidade: '', obs: '',
};

const TIPOS_LOGRADOURO = ['Rua', 'Avenida', 'Alameda', 'Travessa', 'Estrada', 'Rodovia', 'Praça', 'Viela', 'Largo', 'Via'];

// dd/mm/aaaa enquanto digita
function mascaraData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}

export default function FormCliente({
  id, nomeInicial, aoSalvar, aoCancelar,
}: {
  id?: number;
  nomeInicial?: string;
  aoSalvar: (cliente: { id: number; nome: string }) => void;
  aoCancelar?: () => void;
}) {
  const [c, setC] = useState<ClienteCompleto>({ ...VAZIO, nome: nomeInicial ?? '' });
  const [carregando, setCarregando] = useState(!!id);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<ClienteCompleto>(`/clientes/${id}`)
      .then(setC)
      .catch((e) => setErro((e as Error).message))
      .finally(() => setCarregando(false));
  }, [id]);

  const muda = (chave: keyof ClienteCompleto) => (v: string) => setC((x) => ({ ...x, [chave]: v }));

  async function buscarCep() {
    const cep = c.cep.replace(/\D/g, '');
    if (cep.length !== 8) return Alert.alert('CEP deve ter 8 números');
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) throw new Error('CEP não encontrado');
      const [primeira, ...resto] = String(d.logradouro ?? '').split(' ');
      const temTipo = TIPOS_LOGRADOURO.includes(primeira);
      setC((x) => ({
        ...x,
        tipoEndereco: temTipo ? primeira : x.tipoEndereco,
        endereco: temTipo ? resto.join(' ') : d.logradouro ?? x.endereco,
        bairro: d.bairro || x.bairro,
        cidade: d.localidade || x.cidade,
        uf: d.uf || x.uf,
        codigoCidade: d.ibge || x.codigoCidade,
      }));
    } catch (e) {
      Alert.alert('Não foi possível buscar o CEP', (e as Error).message);
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    if (c.nome.trim().length < 2) return Alert.alert('Informe o nome do cliente');
    setSalvando(true);
    try {
      const corpo = c;
      if (id) {
        await api(`/clientes/${id}`, { metodo: 'PATCH', corpo });
        aoSalvar({ id, nome: c.nome.trim().toUpperCase() });
      } else {
        const r = await api<{ id: number }>('/clientes', { metodo: 'POST', corpo });
        aoSalvar({ id: r.id, nome: c.nome.trim().toUpperCase() });
      }
    } catch (e) {
      Alert.alert('Não foi possível salvar', (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Carregando />;

  return (
    <View>
      {erro ? <Aviso texto={erro} /> : null}
      <View style={[estilos.linha, { marginBottom: 12 }]}>
        {(['F', 'J'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setC((x) => ({ ...x, tipo: t }))}
            style={{
              flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
              backgroundColor: c.tipo === t ? cor.azul : cor.cartao,
            }}
          >
            <Text style={{ color: cor.texto, fontWeight: '600' }}>{t === 'F' ? 'Pessoa física' : 'Empresa'}</Text>
          </Pressable>
        ))}
      </View>

      <Campo rotulo={c.tipo === 'J' ? 'Razão social *' : 'Nome *'} value={c.nome} onChangeText={muda('nome')}
        autoCapitalize="characters" />
      <Campo rotulo={c.tipo === 'J' ? 'Nome fantasia / contato' : 'Apelido (ex.: CLAUDIO HB20)'} value={c.apelido}
        onChangeText={muda('apelido')} autoCapitalize="characters" />
      <Campo rotulo="Celular" value={c.celular} onChangeText={muda('celular')} keyboardType="phone-pad"
        placeholder="(11) 99999-9999" />
      <Campo rotulo="Telefone" value={c.telefone} onChangeText={muda('telefone')} keyboardType="phone-pad" />
      <Campo rotulo={c.tipo === 'J' ? 'CNPJ' : 'CPF'} value={c.documento} onChangeText={muda('documento')}
        keyboardType="number-pad" />
      <Campo rotulo="E-mail" value={c.email} onChangeText={muda('email')} keyboardType="email-address" autoCapitalize="none" />
      {c.tipo === 'F' ? (
        <Campo rotulo="Nascimento" value={c.nascimento} onChangeText={(v) => muda('nascimento')(mascaraData(v))}
          keyboardType="number-pad" placeholder="dd/mm/aaaa" />
      ) : null}

      <Text style={estilos.secao}>ENDEREÇO</Text>
      <View style={[estilos.linha, { alignItems: 'flex-end' }]}>
        <View style={estilos.meio}>
          <Campo rotulo="CEP" value={c.cep} onChangeText={muda('cep')} keyboardType="number-pad" />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Botao titulo="Buscar" tipo="secundario" aoTocar={buscarCep} ocupado={buscandoCep} />
        </View>
      </View>
      <View style={estilos.linha}>
        <View style={{ width: 110 }}>
          <Campo rotulo="Tipo" value={c.tipoEndereco} onChangeText={muda('tipoEndereco')} placeholder="Rua" />
        </View>
        <View style={estilos.meio}>
          <Campo rotulo="Endereço" value={c.endereco} onChangeText={muda('endereco')} />
        </View>
      </View>
      <View style={estilos.linha}>
        <View style={{ width: 110 }}>
          <Campo rotulo="Número" value={c.numero} onChangeText={muda('numero')} />
        </View>
        <View style={estilos.meio}>
          <Campo rotulo="Complemento" value={c.complemento} onChangeText={muda('complemento')} />
        </View>
      </View>
      <Campo rotulo="Bairro" value={c.bairro} onChangeText={muda('bairro')} />
      <View style={estilos.linha}>
        <View style={estilos.meio}>
          <Campo rotulo="Cidade" value={c.cidade} onChangeText={muda('cidade')} />
        </View>
        <View style={{ width: 80 }}>
          <Campo rotulo="UF" value={c.uf} onChangeText={(v) => muda('uf')(v.toUpperCase())} maxLength={2}
            autoCapitalize="characters" />
        </View>
      </View>
      <Campo rotulo="Observações" value={c.obs} onChangeText={muda('obs')} multiline />

      <Botao titulo={id ? 'Salvar alterações' : 'Cadastrar cliente'} aoTocar={salvar} ocupado={salvando} />
      {aoCancelar ? <Botao titulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} /> : null}
    </View>
  );
}
