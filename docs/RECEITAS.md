# Receitas de gravação do SantSystem

Capturadas com Extended Events no SQL Server do SERVIDOR-OFICINA (192.168.0.20) em 07/10/2026,
observando o programa `MDIPAF` (SantSystem) em uso real. Fonte bruta: `dados/captura-mdipaf-*.txt`.

Convenções do banco `dadosretorno`:
- Quase tudo é `varchar`. Valores com vírgula decimal (`'132,00'`), datas como número de dias desde 30/12/1899 (`'46302'` = 07/10/2026).
- IDs (`PedVendaCab.Id`, `PedVendaProd.Id`, `Servicos_OS.Id`, `Recebimentos.id`) são IDENTITY.
- Nenhum trigger no banco: toda regra está no programa.
- O SantSystem grava por cursor ADO no servidor (`sp_cursor`), que equivale a INSERT/UPDATE das colunas listadas.

## Abrir OS — confirmado (OS 15293, 15:39:25)

1. `INSERT INTO PedVendaCab` com:
   `ChvCad` (cliente = `Cadastros.ChvCadastros`), `DtPed`/`DtPrev`/`DtVal` = hoje, `Final='0'`, `Excluido='0'`,
   `ChvFunc` (funcionário), `PlacaVei`, `Marca`, `Modelo`, `Ano_Veiculo`, `Cor`, `KM`, `Combustivel`, `Motor`,
   totais zerados (`TotItens`, `TotalPed`, `TxtTotGer`, `Vl_Br_Serv`, `Vl_LQ_Serv`, `TotCusItens`, `TotCusServ` = `'0,00'`;
   `TotDesc`, `Perc_Desc_Serv`, `Vl_Desc_Serv`, `DescP` = `'0,0000'`),
   fixos: `Origem='O.S'`, `CKMVO='Venda'`, `NfES='S'`, `Pres='1'`, `TipFret='9'`, `TXTQtdV='01'`, `TxtEsp='Volume'`,
   `TxtMarc='Diversos'`, `TxtNum='01'`, `TxtPb`/`TxtPLiq`=`'0,000'`, `TxtPlac='___-____'`, `NVMovel='0'`,
   `BP='NãoConfig'`, `VlComis='NãoConfig'`, demais textos vazios.
2. `UPDATE PedVendaCab SET DadosAdicionais = 'Empresa optante pelo simples não da direito a crédito ICMS IPI.        ' WHERE id = <nova OS>`

## Lançar peça — confirmado (OS 15293, 15:39:59)

1. `INSERT INTO PedVendaProd`: `ChvPed` (OS), `ChvCad`, `Nitem` (sequencial na OS), `Cod`, `Descr`, `QtdPed`=`QtdVnd`,
   `VlUnitBr`, `VlDesc='0,00%'`, `VlLiq`, `SubTotPed`=`SubTotVnd`, `UnMed`, `NCM`, `Regra`, `ICPS`, `CFOP`, `CSTICMS`,
   `Custo`, `Identificador` (GUID-like), `Baixado='Não'`, `Excluido='0'`, `Calc='1'`, `PrcUtil='1'`, `TipDesc='P'`,
   `BP`/`PeCom`/`VlComis`=`'NãoConfig'`. Dados da peça vêm de `codigos`: o código digitado é procurado em
   `codigos.Cod` e o item é `codigos.ChvProd` (= `Itens.ICPS`). **Há 15 códigos repetidos em `Itens`** (ex.: `559` =
   rolamento Corsa e kit da barra estabilizadora); procurar direto em `Itens.Cod` pega o item errado.
2. `UPDATE PedVendaCab`: `TotItens`, `TotalPed` (= soma das peças), `TxtTotGer` (= peças + serviços), `TotCusItens`.
3. `UPDATE PedVendaCab SET DadosAdicionais = 'Total aproximado dos Tributos ... Fonte IBPT/empresometro.com.br ...'`
   (IBPT: falta descobrir de onde sai a alíquota — provavelmente tabela IBPT por NCM).

Lançar peça NÃO baixa estoque (`Baixado='Não'`).

## Lançar serviço — confirmado (OS 15292, 15:41:29)

1. `INSERT INTO Servicos_OS (Codigo, Descr, Quant, VlUnit, SubTot, Obs_Servico, Perc_Comissao, VL_Comissao, Id_Servico, Id_Funcionario, Id_Venda, Sit, Guid_Linha, Custo, Terceirizado, BP)`
   com `Sit='N'`, `Terceirizado='Não'`, `BP='Pendente'`. Dados do serviço vêm de `Servicos`.
2. `UPDATE PedVendaCab`: `Vl_Br_Serv`, `Vl_LQ_Serv` (= soma dos serviços), `TxtTotGer`, `TotCusServ`.

- No serviço, `Codigo` é o código de tela e `Id_Servico` é `Servicos.Id` (podem ser diferentes: código 6 = Id 2).

## Salvar / alterar OS — confirmado (OS 15292 às 15:59:57, OS 15294 às 16:02–16:04)

- Cada "salvar" regrava a OS inteira: `UPDATE` do cabeçalho com todos os campos, `UPDATE` de cada peça existente
  (cursor em `PedVendaProd WHERE ID = <id>`), `UPDATE Servicos_OS SET ... WHERE id = <id>` para cada serviço,
  e `INSERT` só para itens novos.
- Alterar preço da peça: muda `VlUnitBr`, `VlLiq`, `SubTotPed`, `SubTotVnd` da peça + totais do cabeçalho.
- Alterar custo: muda `PedVendaProd.Custo` / `Servicos_OS.Custo` e `TotCusItens` / `TotCusServ` no cabeçalho.
- Observação: campo `PedVendaCab.OBS`.
- Peça com quantidade > 1 (óleo 5 × 64,00): `QtdPed`/`QtdVnd` = `'5,000'`.
- O programa também ajusta `CFOP='5405'`, `CSTICMS='500'` nos itens (às vezes em rotina periódica, a cada ~1 min).

## Excluir OS — confirmado (OS 15294, 16:04:48)

1. `UPDATE PedVendaCab SET excluido = '1' WHERE id LIKE '<os>'`
2. `UPDATE PedVendaProd SET excluido = '1' WHERE ChvPed LIKE '<os>'`

Os serviços NÃO são marcados (continuam `Sit='N'`); quem lê precisa filtrar pelo cabeçalho.

## Cadastrar cliente — confirmado (cliente 5937, 16:01:09)

1. `INSERT INTO Cadastros` (cursor) com `nom`, `apdoftsia` (fantasia), `TipFisJur`, `CPF`, `RG`, `nasc`, `datCad` (dd/mm/aaaa
   em texto!), endereço etc., `Fiscal='0'`, `Caixa='0'`, `Cod='1'`.
2. Preenche `ICCS` e `ChvCAd1` com o `ChvCadastros` gerado (os três ficam iguais).
3. `INSERT INTO CadExt` uma linha por PC do `CompuExt` (`ChvCompu` = `CompuExt.Id`, `NomePc`, `Sit='P'`, `Token_PC`).
   O `MonitorSantSystem` de cada PC atualiza a lista e muda para `Sit='F'` em segundos.
4. `INSERT INTO Registra_Movimento (Data, Hora, Computador, Usuario, Nome_Usuario, Tipo, Tela, Identificacao_Registro)`
   — log de auditoria (`Tipo='Insert'`, `Tela='FrmCadCli2'`).
5. `UPDATE Cadastros SET Env_Web = 'P', Cadastro_Xml = '<xml do cadastro>'`.

Editar cliente: mesmo fluxo com `UPDATE`, `Registra_Movimento.Tipo='Update'` e `CadExt.Sit` de volta para `'P'`.

## Finalizar OS + receber no caixa — confirmado (OS 15296, 16:09:51–16:10:06, R$ 188,00 dinheiro)

Fonte: `dados/fechamento-15296-todos.txt` (todos os programas) e `dados/fechamento-15296-resumo.txt`.

### Parte do SantSystem (MDIPAF)

Finalizar (16:09:51):
1. `UPDATE PedVendaCab` com `Final='1'` e `Dtfim` = hoje (número de dias).
2. Para cada peça não baixada:
   - `UPDATE ProdExt SET Sit='P', Excluir='P' WHERE CHVPROD = <ICPS>` (avisa os PCs)
   - `UPDATE PedVendaProd SET Baixado='Sim' WHERE id = <id da peça>`
   - `INSERT INTO Produtos` (movimento de saída): `TipMov='O.S'`, `IDVenda`=OS, `IDOrigem`=`NIDPROD`=`IDProd`=id da peça,
     `ICPS`, `Cod`, `Descr`, `Quant`, `VlUnit`, `SubTot`, `CustoUnit`, `CustoTot`, `CST='60'`, `Sit='1'`, `SitRet='P'`,
     `DataGr`/`HoraGr`, `DataNumero`, `ChvCAd`, `ChvFunc`, `IPPC`/`UsuPC` (PC), `NumeroPC`, `PrecoOrig`, `BaixaConvenio='OK'`,
     `Setor1='1'`, `Setor3='1'`, `FREC='1'`, `IMPEM='0,00;0,00'`, `ImprRes='S'`, `SitDev='0'`, `Identificador` (novo).
   - `INSERT INTO Produtos26_4` com os mesmos dados. **As tabelas com número no nome não são cópias antigas**:
     `Produtos26_4` é a tabela do período atual (provavelmente 2026, 4º trimestre) e recebe gravação viva.
   - OS sem peças: só o passo 1 (visto na OS 15295).

Receber (16:10:00) — gera um GUID de venda (`2288007102026...`):
1. `INSERT INTO Recebimentos` (`IDVENDA`=OS, `TotalVenda`, `VlVenda`, `VlDin`/`VlCC`/`VlCd`/... por forma de pagamento,
   `Sit='4'`, `TipoRec='PDV'`, `SitRet='P'`, `ChvAbertura` = abertura de caixa (`AbCai`), `IdComputador`, `Guid_Venda`).
2. `INSERT INTO RectParcCab` (título: `Txtnome`=cliente, `TxtNOrig`='<OS> - OfExemplo', `TxtVl`, `TipoRecto='CAIXA'`).
3. `INSERT INTO RectParc` (parcela paga: `TxtFRecto='Dinheiro'`, `TxtCC='Caixa'`, `BAIXADO='True'`, `Situacao='1'`).
4. `UPDATE Produtos`/`Produtos26_4`/`PedVendaCab SET guid_venda/guid = <GUID>` da OS.
5. `UPDATE Vendas ...` e `CartoesValores` (0 linhas — `Vendas` é do PDV/NFC-e, não existe para OS).

### Parte do MonitorSantSystem (automática, ~7 s depois)

Ao ver `Produtos.sit='1'`:
1. `INSERT INTO PRODUTOS_SALDO (Data, ICPS, Saldo_Anterior, Quant_Entrada, Quant_Saida, Saldo_Atual)`
2. `UPDATE Itens SET Estoque = <novo saldo>` (estoque fica em `Itens.Estoque`; o da pastilha 375 está em −868)
3. `INSERT INTO Produto_Saldo_Kardex (id_Produto_Saldo, id_Tabela_Origem, Tabela_Origem, Quant)`
4. `UPDATE Produtos SET sit='4'` (processado). Também copia `Recebimentos` → `RecebimentosR` e usa
   `dadospaf.RectParcCab`/`RectParc` como tabela de passagem (apaga tudo lá; ficam vazias).

**Conclusão: o app NÃO mexe em estoque.** Basta gravar `Produtos` como o SantSystem; o monitor baixa o estoque e faz o kardex.

## Alterar preço de venda do produto — confirmado (item 4372 / cód. 52205212, 09/10/2026 09:08–09:10)

Fonte: `dados/captura-preco-remover-item-2026-10-09.txt` (preço 296,00 → 479,00, salvo 3 vezes na tela
`FrmCadProd`). Tudo pelo programa `MDIPAF`; o `MonitorSantSystem` completa depois.

1. `UPDATE Itens` (cursor em `Select * from Itens Where iCPS = '<icps>'`) regravando **a linha inteira** com o que
   está na tela. O que muda numa troca de preço:
   - `PrecVen`, `Precven2`, `PrecVen3`, `PrecProm` = novo preço (a tela iguala os quatro);
   - `Marg`, `marg2`, `marg3` = margem sobre o custo com 4 casas: `(venda / Custo − 1) × 100`
     (479,00 / 169,69 → `'182,2795'`); `margP` fica `'0,0000'`;
   - `DTAlt` = hoje (número de dias), `HoraAlt` = fração do dia.
   - Efeito colateral da tela (não copiar): ela recalcula `MRegra` pela regra fiscal (`RDE`) e marcou `Setor3='1'`.
2. `INSERT INTO Registra_Movimento` com `Tipo='Update'`, `Tela='FrmCadProd'`, `Identificacao_Registro=<icps>`
   (o programa grava o usuário logado; pela regra da oficina, o app deixa em branco).
3. Para **cada PC** do `CompuExt`: `UPDATE ProdExt SET Sit='P', Excluir='P', SitLicenca=NULL, DtAlt=<hoje>,
   HoraAlt=<fração>, Token_PC=<Token_PC do SERVIDOR-OFICINA> WHERE CHVPROD=<icps> AND NomePc=<PC>` (avisa os monitores).
4. `UPDATE Codigos SET ChvProd=<icps>, UNMED, QTDE, SitLicenca=NULL, DtAlt, HoraAlt WHERE Cod=<cód>`.
5. `INSERT INTO AtuProdDetalhado (Icps, Data_Alt, Estoque_Ant, PRECO_ANT, Origem)` com
   `Data_Alt='aaaa-mm-dd hh:mm:ss'`, `PRECO_ANT` = **preço anterior**, `Origem='Cadastro'`.
6. `UPDATE AtuProd SET Sit='P', ST='0', DtNum=<hoje> WHERE IDProd=<icps>` (a linha já existia).
7. `DELETE FROM CodigosSP WHERE ChvProd=<icps>`, `DELETE FROM ItensSP WHERE ICPS=<icps>`,
   `UPDATE Itens SET BKP=NULL WHERE ICPS=<icps>`.
8. `INSERT INTO ItensLog` — cópia da linha do item (histórico), com `DataGr`/`HoraGr` = agora (texto).
9. Cópia XML: `UPDATE Itens SET item_Xml=''`, depois monta
   `<?xml version="1.0"?><Item_Completo><Codigos>(SELECT * FROM Codigos WHERE ChvProd FOR XML PATH('Codigo'))</Codigos>`
   `<Itens>(SELECT * FROM itens WHERE ICPS FOR XML PATH('Item'))</Itens></Item_Completo>` (uma tag por linha, vazio
   vira quebra de linha — mesmo formato do `Cadastro_Xml`) e grava `UPDATE Itens SET Env_Web='P', item_Xml=<xml>`.

Rotinas da tela que **não** fazem parte da receita: `delete from itens where icps='0'`, `delete from Codigos where
ChvProd='0'`, `Delete from setor` + `exec Setor` (refaz a lista de setores) e os `UPDATE codigos/Itens SET ... WHERE
... IS NULL` de preenchimento padrão ao abrir o programa.

**MonitorSantSystem** (10–50 s depois, ao ver `ProdExt.Sit='P'`): regrava `Itens` (preços, margens, custo, estoque,
`MRegra`/`Ncm`) e `Codigos` a partir da cópia dele. Ou seja, o aviso do passo 3 é o que espalha a mudança.

## Alterar a tributação (regra) do produto — confirmado (item 4364 / 46337579, 19/10/2026 13:59:56)

Tela de cadastro de produto (`FrmCadProd`), regra **A → B**. É o mesmo "salvar produto" da alteração de preço,
só mudando os campos fiscais. Captura: `captura_20261019*.xel` (13:58:35–14:00:25).

Regras (`RegrasSat`): **A** "Com Substituição" (CFOP 5405, CST 60, CSOSN 500), **B** "Item tributado" (5102, 00, 102),
**C** isento (5102, 40, 300), **D** não tributado (5102, 41, 300), **E** outros (5102, 90, 900).

1. Leituras da tela: `AliqNCM` e `Cest` pelo NCM, `erp_ncm`, `RegrasSat WHERE Regra='B'`, `CodGrupoid`.
2. `sp_cursor` UPDATE da linha inteira de `Itens` com: `RDE`, `RFE`, `RFEIE`, `RFECPF`, `LRegra` = nova regra;
   `CFOP` e `CST` = os da regra em `RegrasSat` (B: `'5102'`, `'00'`); `DTAlt`/`HoraAlt`. **`MRegra` não muda**
   (continua `...|5405|60|...|500|...`) e o preço fica igual.
3. `INSERT Registra_Movimento` (`Tipo='Update'`, `Tela='FrmCadProd'`, `Identificacao_Registro`=ICPS).
4. `ProdExt` de cada PC (`exec CompuExt`): `Sit='P'`, `Excluir='P'`, `DtAlt`, `HoraAlt`, `Token_PC`.
5. `Codigos` (cursor): `ChvProd`, `UNMED`, `QTDE`, `DtAlt`, `HoraAlt`.
6. `AtuProd WHERE IDProd=<icps>`: `Sit='P'`, `ST='0'`, `DtNum`. (Sem `AtuProdDetalhado`: o preço não mudou.)
7. `DELETE CodigosSP`/`ItensSP` do ICPS, `UPDATE Itens SET BKP=NULL`, `INSERT ItensLog` (linha inteira),
   `item_Xml=''` e depois `item_Xml=<XML>`, `Env_Web='P'`.

Fora da receita (rotinas da tela): `delete from itens where icps='0'`, `delete from Codigos where ChvProd='0'`,
`Delete from setor` + `exec Setor`.

**Feito por fora do SantSystem em 19/10/2026** (itens 3268/55202374 e 4336/55206749, A → B, nota Delta
000123), com backup antes em `dados/backup-tributacao-2026-10-19*` (JSON + SQL para desfazer). Detalhes:
- `ItensLog` copia a linha de `Itens`, mas `ICPS`, `Sit` e `Imagem` têm tipo diferente lá (varchar × int/image):
  `ICPS` e `Sit` vão convertidos para texto; `Imagem` fica de fora. `DataGr`/`HoraGr` = agora (`dd/mm/aaaa`, `hh:mm:ss`).
- `item_Xml`: o XML montado com as colunas na ordem da tabela, sem nulas, vazio = `\r\n` e o próprio `Item_Xml`
  vazio saiu **idêntico** ao gravado pelo SantSystem no 4364.
- O monitor do SERVIDOR-OFICINA marcou `ProdExt` como `'F'` em ~1 min e a regra B se manteve. As OS já lançadas **não** mudam: a peça 43188 da OS 15348 continuou com
`Regra='A'`, CFOP 5405, CSOSN 500.

**Como a regra vai para a peça da OS** (`PedVendaProd`, cliente de SP): `Regra` = `Itens.RDE`, `CFOP` =
`Itens.CFOP`, `CSTICMS` = **`'102'` se a regra é B, senão `'500'`** (A e E). Cliente sem UF ou de fora de SP:
CFOP de fora (6404, 6102, 6656) e `CSTICMS` vazio — o SantSystem faz assim (906 peças com UF vazia).

## Remover peça da OS — confirmado (peça 42960 na OS 15316, 09/10/2026 09:11:54)

1. `UPDATE PedVendaProd SET Excluido='1', Baixado='Não' WHERE id=<id da peça>` (exclusão lógica; os outros itens
   não são renumerados — só havia um item neste teste).
2. `UPDATE Produtos SET Sit='12', TipMov='Excluido ' + TipMov WHERE idOrigem=<id da peça> AND TipMov='O.S' AND
   idvenda=<OS>` e `UPDATE Produtos26_4 SET Sit='2', TipMov=TipMov + 'Excluido O.S' WHERE` (mesmo filtro).
   Em OS aberta não há movimento em `Produtos` (0 linhas); só tem efeito se a peça já tinha sido baixada.
3. `UPDATE PedVendaCab` (cursor, cabeçalho inteiro) com os totais recalculados sem a peça
   (`TotItens`, `TotalPed`, `TxtTotGer`, `TotCusItens`).
4. `UPDATE PedVendaCab SET DadosAdicionais = 'Empresa optante pelo simples não da direito a crédito ICMS IPI. '`
   (sem peças, volta o texto do Simples; com peças fica o texto IBPT).

Na API: `DELETE /os/:id/pecas/:pecaId` (passos 1 a 4; o texto do Simples só é regravado quando não sobra peça).

## Remover serviço da OS — pelos dados (não capturado com Extended Events)

Serviços removidos pelo SantSystem (ex.: 16889 e 16892 da OS 15362, 16/10/2026) ficam com a linha igual,
só com `Sit='EX'`; os totais do cabeçalho saem sem eles. Receita usada:

1. `UPDATE Servicos_OS SET Sit='EX' WHERE Id=<id do serviço> AND Id_Venda=<OS>`.
2. Totais do cabeçalho recalculados (`Vl_Br_Serv`, `Vl_LQ_Serv`, `TotCusServ`, `TxtTotGer`).

Na API: `DELETE /os/:id/servicos/:servicoId`. Todo lugar que lê serviço já filtra `ISNULL(Sit,'N') <> 'EX'`.

## Marca e modelo do veículo

A tela de OS do SantSystem só mostra marca/modelo iguais aos das listas `Veiculo_Marca` e `Veiculo_Modelo`
(ver BANCO-DE-DADOS.md, 4.1). Cadastrar modelo novo: `INSERT Veiculo_Modelo (Modelo, IdMarca, Sit) VALUES
(<MAIÚSCULAS>, <Veiculo_Marca.Id>, 'N')` — `Identificador` e `BKP` ficam nulos, como o último cadastrado pelo
SantSystem (MAVERICK, Id 231). Na API: `POST /veiculos/modelos`.

## Pendente

- Recebimento com cartão / Pix / parcelado (só vimos dinheiro)
- Estornar/cancelar recebimento, reabrir OS finalizada
- Dar desconto
- Cadastrar produto novo, mudar custo
- Papel do `MonitorSantSystem` (grava bastante; checar se reage a OS fechada)
- De onde sai o texto IBPT (tributos aproximados) de `DadosAdicionais`
