-- Historico de um carro pela placa (formato antigo e Mercosul): troque as duas placas
-- Mercosul: o 5o caractere vira letra (0=A, 1=B, 2=C, ... 9=J). Ex.: ABC1323 <-> ABC1D23
SELECT c.Id AS os, cad.nom AS cliente, c.PlacaVei AS placa, c.Modelo, c.KM, c.TxtTotGer AS total,
       CONVERT(varchar(10), DATEADD(day, CAST(c.DtPed AS int), '18991230'), 103) AS data,
       c.Final AS finalizada
FROM PedVendaCab c LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
WHERE c.Excluido = '0' AND REPLACE(c.PlacaVei, '-', '') IN ('ABC1D23', 'ABC1323')
ORDER BY c.Id DESC;
