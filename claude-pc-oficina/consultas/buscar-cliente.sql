-- Cliente por nome (sem acento), CPF/CNPJ ou celular (com ou sem mascara): troque os textos
SELECT ChvCadastros AS codigo, nom AS nome, apdoftsia AS apelido, CPF AS documento, Cel AS celular, Fone1 AS telefone, Cidade
FROM Cadastros
WHERE Descr = 'Clientes' AND ISNULL(Excluido, 0) <> 1
  AND (nom COLLATE Latin1_General_CI_AI LIKE '%joao%'
       OR CPF LIKE '%12345678909%'
       OR REPLACE(REPLACE(REPLACE(REPLACE(Cel, '(', ''), ')', ''), '-', ''), ' ', '') LIKE '%912345678%')
ORDER BY nom;
