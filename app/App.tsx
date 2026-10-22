import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { lerConfig } from './src/api';
import { Nav, Rota } from './src/nav';
import AdicionarItem from './src/telas/AdicionarItem';
import { Clientes, EditarCliente } from './src/telas/Clientes';
import Config from './src/telas/Config';
import Detalhe from './src/telas/Detalhe';
import Lista from './src/telas/Lista';
import NovaOS from './src/telas/NovaOS';
import Precos from './src/telas/Precos';
import { Carregando, estilos } from './src/ui';

export default function App() {
  const [pilha, setPilha] = useState<Rota[] | null>(null);
  const [primeiraVez, setPrimeiraVez] = useState(false);

  useEffect(() => {
    lerConfig().then((cfg) => {
      setPrimeiraVez(!cfg);
      setPilha([cfg ? { tela: 'lista' } : { tela: 'config' }]);
    });
  }, []);

  const nav: Nav = useMemo(() => ({
    ir: (rota) => setPilha((p) => [...(p ?? []), rota]),
    voltar: () => setPilha((p) => (p && p.length > 1 ? p.slice(0, -1) : p)),
    trocar: (rota) => {
      setPrimeiraVez(false);
      setPilha((p) => [...(p ?? []).slice(0, -1), rota]);
    },
  }), []);

  // Botao voltar do Android volta uma tela; na primeira tela, sai do app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pilha && pilha.length > 1) {
        nav.voltar();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pilha, nav]);

  const rota = pilha?.[pilha.length - 1];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={estilos.tela}>
        <StatusBar style="light" />
        {!rota ? <Carregando /> : null}
        {rota?.tela === 'config' ? <Config nav={nav} primeiraVez={primeiraVez} /> : null}
        {rota?.tela === 'lista' ? <Lista nav={nav} /> : null}
        {rota?.tela === 'os' ? <Detalhe key={rota.id} nav={nav} id={rota.id} /> : null}
        {rota?.tela === 'nova' ? <NovaOS nav={nav} /> : null}
        {rota?.tela === 'peca' ? <AdicionarItem nav={nav} osId={rota.osId} tipo="peca" /> : null}
        {rota?.tela === 'servico' ? <AdicionarItem nav={nav} osId={rota.osId} tipo="servico" /> : null}
        {rota?.tela === 'clientes' ? <Clientes nav={nav} /> : null}
        {rota?.tela === 'precos' ? <Precos nav={nav} /> : null}
        {rota?.tela === 'cliente' ? <EditarCliente key={rota.id ?? 'novo'} nav={nav} id={rota.id} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
