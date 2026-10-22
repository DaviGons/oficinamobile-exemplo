import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from './api';
import { DadosImpressao, htmlDaOS } from './pdfHtml';

// Gera o PDF da OS e abre o compartilhamento (WhatsApp, e-mail, impressora...)
export async function compartilharPdfDaOS(osId: number) {
  const dados = await api<DadosImpressao>(`/os/${osId}/impressao`);
  // A4 em pontos (72 por polegada)
  const { uri } = await Print.printToFileAsync({ html: htmlDaOS(dados), width: 595, height: 842 });
  // Nome amigavel para quem recebe (OS-15292.pdf) em vez do nome aleatorio do expo-print.
  // copy() e assincrono no Android (AsyncFunction): precisa do await antes de apagar a origem.
  let arquivo = uri;
  try {
    const origem = new File(uri);
    const destino = new File(Paths.cache, `OS-${osId}.pdf`);
    if (destino.exists) destino.delete();
    await origem.copy(destino);
    if (destino.exists) {
      arquivo = destino.uri;
      origem.delete();
    }
  } catch {
    // Sem o nome amigavel: compartilha o PDF com o nome gerado pelo expo-print
  }
  await Sharing.shareAsync(arquivo, { mimeType: 'application/pdf', dialogTitle: `OS ${osId}`, UTI: 'com.adobe.pdf' });
}
