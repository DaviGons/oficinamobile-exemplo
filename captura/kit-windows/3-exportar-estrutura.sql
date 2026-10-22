-- Exporta a estrutura do banco atual: tabelas, colunas, chaves,
-- quantidade de linhas e o codigo de triggers, procedures, views e funcoes.
-- So le. Nao exporta dados de clientes.
-- Colunas separadas (sem CONCAT) por causa do conflito de collation
-- entre o catalogo e o banco no SQL Server 2014.
SET NOCOUNT ON;
GO

PRINT '=== TABELAS (linhas) ===';
SELECT t.name AS tabela, SUM(p.rows) AS linhas
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY t.name;
GO

PRINT '';
PRINT '=== COLUNAS ===';
SELECT t.name AS tabela, c.column_id AS ordem, c.name AS coluna, ty.name AS tipo,
    CASE
        WHEN ty.name IN ('varchar', 'char', 'varbinary', 'binary', 'nvarchar', 'nchar') AND c.max_length = -1 THEN -1
        WHEN ty.name IN ('nvarchar', 'nchar') THEN c.max_length / 2
        WHEN ty.name IN ('varchar', 'char', 'varbinary', 'binary') THEN c.max_length
    END AS tamanho,
    CASE WHEN ty.name IN ('decimal', 'numeric') THEN c.precision END AS precisao,
    CASE WHEN ty.name IN ('decimal', 'numeric') THEN c.scale END AS escala,
    c.is_nullable AS aceita_nulo,
    c.is_identity AS identity_,
    c.is_computed AS calculada,
    dc.definition AS padrao
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
ORDER BY t.name, c.column_id;
GO

PRINT '';
PRINT '=== INDICES E CHAVES ===';
SELECT t.name AS tabela, i.name AS indice, i.type_desc AS tipo,
    i.is_primary_key AS pk, i.is_unique AS unico,
    STUFF((SELECT ', ' + c.name
           FROM sys.index_columns ic
           JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
           ORDER BY ic.key_ordinal
           FOR XML PATH('')), 1, 2, '') AS colunas
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
WHERE i.type > 0
ORDER BY t.name, i.name;
GO

PRINT '';
PRINT '=== CHAVES ESTRANGEIRAS ===';
SELECT OBJECT_NAME(fk.parent_object_id) AS tabela, OBJECT_NAME(fk.referenced_object_id) AS referencia, fk.name AS nome
FROM sys.foreign_keys fk
ORDER BY 1;
GO

PRINT '';
PRINT '=== SEQUENCES ===';
SELECT name AS sequence, CAST(current_value AS varchar(40)) AS atual
FROM sys.sequences
ORDER BY name;
GO

PRINT '';
PRINT '=== TRIGGERS, PROCEDURES, VIEWS E FUNCOES ===';
SELECT o.type_desc AS tipo, OBJECT_SCHEMA_NAME(o.object_id) AS esquema, o.name AS nome,
    OBJECT_NAME(NULLIF(o.parent_object_id, 0)) AS tabela,
    m.definition AS codigo
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.is_ms_shipped = 0
ORDER BY o.type_desc, o.name;
GO
