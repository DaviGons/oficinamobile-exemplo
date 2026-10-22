-- Liga uma "escuta" (Extended Events) que registra todo comando SQL
-- enviado aos bancos dadosretorno e dadospaf.
-- NAO altera nenhum dado do SantSystem. Rodar conectado como sa.
SET NOCOUNT ON;
GO

IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'captura_santsystem')
    DROP EVENT SESSION captura_santsystem ON SERVER;
GO

CREATE EVENT SESSION captura_santsystem ON SERVER
ADD EVENT sqlserver.sql_batch_completed (
    ACTION (sqlserver.client_app_name, sqlserver.client_hostname,
            sqlserver.database_name, sqlserver.session_id)
    WHERE (sqlserver.database_name = N'dadosretorno'
        OR sqlserver.database_name = N'dadospaf')),
ADD EVENT sqlserver.rpc_completed (
    ACTION (sqlserver.client_app_name, sqlserver.client_hostname,
            sqlserver.database_name, sqlserver.session_id)
    WHERE (sqlserver.database_name = N'dadosretorno'
        OR sqlserver.database_name = N'dadospaf'))
ADD TARGET package0.event_file (
    SET filename = N'captura_santsystem.xel',
        max_file_size = (500),
        max_rollover_files = (10))
WITH (MAX_DISPATCH_LATENCY = 1 SECONDS,
      EVENT_RETENTION_MODE = ALLOW_SINGLE_EVENT_LOSS);
GO

ALTER EVENT SESSION captura_santsystem ON SERVER STATE = START;
GO

PRINT 'Captura ligada.';
GO
