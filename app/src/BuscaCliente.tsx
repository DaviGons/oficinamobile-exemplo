import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, Cliente } from './api';
import FormCliente from './FormCliente';
import { Aviso, Botao, Campo, Cartao, estilos } from './ui';

// Busca de cliente com opcao de cadastrar um novo ali mesmo
export default function BuscaCliente({
  aoEscolher, aoSemCliente,
}: {
  aoEscolher: (cliente: { id: number; nome: string }) => void;
  aoSemCliente?: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [erro, setErro] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const buscaValida = busca.trim().length >= 2;
  const lista = buscaValida ? clientes : [];

  useEffect(() => {
    if (busca.trim().length < 2) return;
    const t = setTimeout(async () => {
      try {
        setClientes(await api<Cliente[]>(`/clientes?busca=${encodeURIComponent(busca.trim())}`));
        setErro('');
      } catch (e) {
        setErro((e as Error).message);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  if (cadastrando) {
    return (
      <FormCliente
        nomeInicial={busca.trim()}
        aoCancelar={() => setCadastrando(false)}
        aoSalvar={(c) => { setCadastrando(false); aoEscolher(c); }}
      />
    );
  }

  return (
    <View>
      {erro ? <Aviso texto={erro} /> : null}
      <Campo rotulo="Cliente" value={busca} onChangeText={setBusca} placeholder="Nome, CPF ou celular" autoFocus />
      {lista.map((c) => (
        <Cartao key={c.id} aoTocar={() => aoEscolher({ id: c.id, nome: c.nome })}>
          <Text style={estilos.titulo}>{c.nome}</Text>
          <Text style={estilos.suave}>
            {[c.fantasia !== c.nome ? c.fantasia : '', c.celular || c.telefone, c.cidade].filter(Boolean).join(' · ')}
          </Text>
        </Cartao>
      ))}
      {buscaValida && lista.length === 0 ? (
        <Text style={[estilos.suave, { marginBottom: 8 }]}>Nenhum cliente encontrado.</Text>
      ) : null}
      <Botao titulo="+ Cadastrar cliente novo" tipo="secundario" aoTocar={() => setCadastrando(true)} />
      {aoSemCliente ? <Botao titulo="Deixar sem cliente" tipo="secundario" aoTocar={aoSemCliente} /> : null}
    </View>
  );
}
