-- Extrai da captura so os eventos de um programa (padrao MDIPAF), a partir
-- de um ponto (arquivo + offset) para leituras incrementais.
-- Variaveis sqlcmd: PROGRAMA, ARQ_INI, OFF_INI (use NULL para ler do inicio).
-- Ultima linha impressa: OFFSET|<arquivo>|<offset> para a proxima leitura.
SET NOCOUNT ON;
DECLARE @dir nvarchar(4000) = N'C:\Program Files\Microsoft SQL Server\MSSQL12.MSSQLSERVER\MSSQL\Log\';
DECLARE @arq_ini nvarchar(4000) = $(ARQ_INI), @off_ini bigint = $(OFF_INI);

SELECT f.file_name, f.file_offset, CAST(f.event_data AS xml) AS x
INTO #ev
FROM sys.fn_xe_file_target_read_file(@dir + N'captura_santsystem*.xel', NULL, @arq_ini, @off_ini) f
-- Filtro barato em texto antes de converter para XML
WHERE CHARINDEX(N'"client_app_name" package="sqlserver"><value><![CDATA[' + $(PROGRAMA) + N']]>', f.event_data) > 0;

SELECT DATEADD(hour, -3, x.value('(/event/@timestamp)[1]', 'datetime2(3)')) AS hora,
       x.value('(/event/action[@name="client_hostname"]/value)[1]', 'nvarchar(128)') AS pc,
       x.value('(/event/action[@name="client_app_name"]/value)[1]', 'nvarchar(256)') AS programa,
       x.value('(/event/action[@name="session_id"]/value)[1]', 'int') AS sessao,
       x.value('(/event/data[@name="row_count"]/value)[1]', 'bigint') AS linhas,
       COALESCE(x.value('(/event/data[@name="batch_text"]/value)[1]', 'nvarchar(max)'),
                x.value('(/event/data[@name="statement"]/value)[1]', 'nvarchar(max)')) AS texto
FROM #ev
WHERE x.value('(/event/action[@name="client_app_name"]/value)[1]', 'nvarchar(256)') = $(PROGRAMA)
ORDER BY file_name, file_offset;

DECLARE @ult_arq nvarchar(4000), @ult_off bigint;
SELECT TOP 1 @ult_arq = file_name, @ult_off = file_offset FROM #ev ORDER BY file_name DESC, file_offset DESC;
PRINT 'OFFSET|' + ISNULL(@ult_arq, '') + '|' + ISNULL(CAST(@ult_off AS varchar(30)), '');
