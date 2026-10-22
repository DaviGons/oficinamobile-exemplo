-- Uma OS completa: troque 15305 pelo numero da OS (nas tres consultas)
SELECT c.Id AS os, cad.nom AS cliente, c.PlacaVei AS placa, c.Marca, c.Modelo, c.Ano_Veiculo AS ano, c.KM,
       c.Final AS finalizada, c.Excluido AS excluida, c.TotalPed AS pecas, c.Vl_LQ_Serv AS servicos, c.TxtTotGer AS total
FROM PedVendaCab c LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
WHERE c.Id = 15305;

SELECT Nitem AS item, Cod AS codigo, Descr AS descricao, QtdPed AS qtd, VlUnitBr AS unitario, SubTotPed AS total, Custo AS custo_total
FROM PedVendaProd WHERE ChvPed = '15305' AND Excluido = '0' ORDER BY TRY_CAST(Nitem AS int);

SELECT Codigo AS codigo, Descr AS descricao, Quant AS qtd, VlUnit AS unitario, SubTot AS total, Custo AS custo
FROM Servicos_OS WHERE Id_Venda = '15305' AND ISNULL(Sit, 'N') <> 'EX';
