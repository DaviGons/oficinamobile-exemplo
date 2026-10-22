-- Faturamento das OS finalizadas por mes no ano atual
SELECT YEAR(d) AS ano, MONTH(d) AS mes, COUNT(*) AS os,
       SUM(CAST(REPLACE(TxtTotGer, ',', '.') AS decimal(12, 2))) AS total
FROM (SELECT DATEADD(day, CAST(Dtfim AS int), '18991230') AS d, TxtTotGer
      FROM PedVendaCab
      WHERE Origem = 'O.S' AND Final = '1' AND Excluido = '0' AND ISNUMERIC(Dtfim) = 1) x
WHERE YEAR(d) = YEAR(GETDATE())
GROUP BY YEAR(d), MONTH(d)
ORDER BY mes;
