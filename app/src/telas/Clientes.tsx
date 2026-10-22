import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, Cliente } from '../api';
import FormCliente from '../FormCliente';
import { Nav } from '../nav';
import { Aviso, Botao, Campo, Cartao, estilos, Topo } from '../ui';

export function Clientes({ nav }: { nav: Nav }) {
  const [busca, setBusca] = useState('');
  const [resultado, setResultado] = useState<Cliente[]>([]);
  const [erro, setErro] = useState('');
  const buscaValida = busca.trim().length >= 2;
  const lista = buscaValida ? resultado : [];

  useEffect(() => {
    if (busca.trim().length < 2) return;
    const t = setTimeout(async () => {
      try {
        setResultado(await api<Cliente[]>(`/clientes?busca=${encodeURIComponent(busca.trim())}`));
        setErro('');
      } catch (e) {
        setErro((e as Error).message);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <>
      <Topo titulo="Clientes" aoVoltar={nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Botao titulo="+ Novo cliente" aoTocar={() => nav.ir({ tela: 'cliente' })} />
        <View style={{ height: 8 }} />
        <Campo value={busca} onChangeText={setBusca} placeholder="Buscar por nome, CPF ou celular" />
        {erro ? <Aviso texto={erro} /> : null}
        {lista.map((c) => (
          <Cartao key={c.id} aoTocar={() => nav.ir({ tela: 'cliente', id: c.id })}>
            <Text style={estilos.titulo}>{c.nome}</Text>
            <Text style={estilos.suave}>
              {[c.fantasia !== c.nome ? c.fantasia : '', c.celular || c.telefone, c.cidade].filter(Boolean).join(' · ')}
            </Text>
          </Cartao>
        ))}
        {buscaValida && !lista.length ?<Text style={estilos.suave}>Nenhum cliente encontrado.</Text> : null}
      </ScrollView>
    </>
  );
}

export function EditarCliente({ nav, id }: { nav: Nav; id?: number }) {
  return (
    <>
      <Topo titulo={id ? `Cliente ${id}` : 'Novo cliente'} aoVoltar={nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <FormCliente id={id} aoSalvar={() => nav.voltar()} aoCancelar={nav.voltar} />
      </ScrollView>
    </>
  );
}
