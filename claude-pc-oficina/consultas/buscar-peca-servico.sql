-- Peca no catalogo (codigo ou descricao sem acento) e servicos: troque os textos
SELECT TOP 30 ICPS, Cod AS codigo, Descr AS descricao, PrecVen AS preco, Custo AS custo, Estoque, UNMED AS un
FROM Itens
WHERE Cod = 'amortecedor' OR Descr COLLATE Latin1_General_CI_AI LIKE '%amortecedor%'
ORDER BY Descr;

SELECT Id AS servicoId, Codigo AS codigo, Descr AS descricao, Valor AS valor, Custo AS custo
FROM Servicos
WHERE Descr COLLATE Latin1_General_CI_AI LIKE '%alinhamento%' OR Codigo = '6'
ORDER BY Descr;
