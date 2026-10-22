-- OS abertas, das mais recentes para as mais antigas
SELECT TOP 50 c.Id AS os, cad.nom AS cliente, c.PlacaVei AS placa, c.Marca, c.Modelo, c.TxtTotGer AS total,
       CONVERT(varchar(10), DATEADD(day, CAST(c.DtPed AS int), '18991230'), 103) AS abertura
FROM PedVendaCab c
LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
WHERE c.Origem = 'O.S' AND c.Final = '0' AND c.Excluido = '0'
ORDER BY c.Id DESC;
