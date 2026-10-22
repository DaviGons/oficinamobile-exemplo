-- Le tudo o que a captura registrou, imprime em texto e desliga a captura.
-- Rodar conectado como sa.
SET NOCOUNT ON;

-- Da tempo da escuta gravar os ultimos eventos no arquivo
WAITFOR DELAY '00:00:03';

DECLARE @arq nvarchar(4000), @dir nvarchar(4000);

SELECT @arq = CAST(t.target_data AS xml).value('(/EventFileTarget/File/@name)[1]', 'nvarchar(4000)')
FROM sys.dm_xe_sessions s
JOIN sys.dm_xe_session_targets t ON t.event_session_address = s.address
WHERE s.name = N'captura_santsystem' AND t.target_name = N'event_file';

-- Sem caminho no CREATE, o arquivo vai para a pasta de log da instancia
IF @arq IS NULL
    SET @arq = CAST(SERVERPROPERTY('ErrorLogFileName') AS nvarchar(4000));

SET @dir = LEFT(@arq, LEN(@arq) - CHARINDEX(N'\', REVERSE(@arq)) + 1);

WITH ev AS (
    SELECT CAST(event_data AS xml) AS x
    FROM sys.fn_xe_file_target_read_file(@dir + N'captura_santsystem*.xel', NULL, NULL, NULL)
), campos AS (
    SELECT
        x.value('(/event/@timestamp)[1]', 'datetime2(3)') AS quando_utc,
        x.value('(/event/@name)[1]', 'nvarchar(60)') AS evento,
        x.value('(/event/action[@name="client_hostname"]/value)[1]', 'nvarchar(128)') AS pc,
        x.value('(/event/action[@name="client_app_name"]/value)[1]', 'nvarchar(256)') AS programa,
        x.value('(/event/action[@name="session_id"]/value)[1]', 'int') AS sessao,
        x.value('(/event/action[@name="database_name"]/value)[1]', 'nvarchar(128)') AS banco,
        x.value('(/event/data[@name="row_count"]/value)[1]', 'bigint') AS linhas,
        COALESCE(x.value('(/event/data[@name="batch_text"]/value)[1]', 'nvarchar(max)'),
                 x.value('(/event/data[@name="statement"]/value)[1]', 'nvarchar(max)')) AS texto
    FROM ev
)
SELECT CONCAT(CONVERT(varchar(23), quando_utc, 121), ' UTC | ', evento,
              ' | pc ', pc, ' | ', programa, ' | sessao ', sessao,
              ' | ', banco, ' | linhas ', linhas,
              CHAR(13), CHAR(10), texto, CHAR(13), CHAR(10), '----------')
FROM campos
WHERE ISNULL(programa, N'') NOT LIKE N'%Management Studio%'
   OR texto LIKE N'%MARCA:%'
ORDER BY quando_utc;

IF EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'captura_santsystem')
    ALTER EVENT SESSION captura_santsystem ON SERVER STATE = STOP;
IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'captura_santsystem')
    DROP EVENT SESSION captura_santsystem ON SERVER;
