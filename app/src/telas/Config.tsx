import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { api, Config as Cfg, configAtual, Funcionario, salvarConfig } from '../api';
import { Nav } from '../nav';
import { Aviso, Botao, Campo, Cartao, cor, estilos, Topo } from '../ui';

export default function Config({ nav, primeiraVez }: { nav: Nav; primeiraVez: boolean }) {
  const atual = configAtual();
  // Padrao: API instalada no PC da oficina (SERVIDOR-OFICINA; IP pelo cabo desde a rede nova de 19/10/2026)
  const [url, setUrl] = useState(atual?.url ?? 'http://192.168.0.10:3333');
  const [token, setToken] = useState(atual?.token ?? '');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escolhido, setEscolhido] = useState<number | null>(atual?.funcionarioId ?? null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function testar() {
    setErro('');
    setOcupado(true);
    try {
      const lista = await api<Funcionario[]>('/funcionarios', { config: { url: url.trim(), token: token.trim() } });
      setFuncionarios(lista);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    const f = funcionarios.find((x) => x.id === escolhido);
    if (!f) return setErro('Escolha quem está usando o app');
    const nova: Cfg = { url: url.trim(), token: token.trim(), funcionarioId: f.id, funcionarioNome: f.nome };
    await salvarConfig(nova);
    if (primeiraVez) nav.trocar({ tela: 'lista' });
    else nav.voltar();
  }

  return (
    <>
      <Topo titulo="Ajustes" aoVoltar={primeiraVez ? undefined : nav.voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {primeiraVez ? (
          <Aviso tipo="info" texto="Informe o endereço da API (o notebook na rede da oficina) e o código de acesso." />
        ) : null}
        <Campo rotulo="Endereço da API" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <Campo rotulo="Código de acesso" value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry />
        {erro ? <Aviso texto={erro} /> : null}
        <Botao titulo="Conectar" tipo="secundario" aoTocar={testar} ocupado={ocupado} />

        {funcionarios.length ? (
          <>
            <Text style={estilos.secao}>QUEM ESTÁ USANDO</Text>
            {funcionarios.map((f) => (
              <Cartao key={f.id} aoTocar={() => setEscolhido(f.id)}>
                <Text style={[estilos.texto, escolhido === f.id && { color: cor.azul, fontWeight: '700' }]}>
                  {escolhido === f.id ? '● ' : '○ '}{f.nome}
                </Text>
              </Cartao>
            ))}
            <Botao titulo="Salvar" aoTocar={salvar} desativado={!escolhido} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
