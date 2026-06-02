IF OBJECT_ID('dbo.watchlist', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.watchlist (
    id INT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(12) NOT NULL UNIQUE,
    name NVARCHAR(120) NOT NULL DEFAULT '',
    note NVARCHAR(240) NOT NULL DEFAULT '',
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.positions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.positions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(12) NOT NULL,
    trade_date DATE NOT NULL,
    shares DECIMAL(18,6) NOT NULL CHECK (shares > 0),
    price DECIMAL(18,6) NOT NULL CHECK (price > 0),
    fees DECIMAL(18,6) NOT NULL DEFAULT 0 CHECK (fees >= 0),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX idx_positions_symbol_date ON dbo.positions(symbol, trade_date);
END;

IF OBJECT_ID('dbo.settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.settings (
    [key] NVARCHAR(64) NOT NULL PRIMARY KEY,
    [value] NVARCHAR(240) NOT NULL
  );
END;

IF OBJECT_ID('dbo.stock_price_snapshots', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_price_snapshots (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(12) NOT NULL,
    provider NVARCHAR(40) NOT NULL,
    price DECIMAL(18,6) NOT NULL,
    change_value DECIMAL(18,6) NOT NULL DEFAULT 0,
    change_pct DECIMAL(18,6) NOT NULL DEFAULT 0,
    as_of NVARCHAR(40) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX idx_stock_price_snapshots_symbol_created ON dbo.stock_price_snapshots(symbol, created_at DESC);
END;

IF OBJECT_ID('dbo.technical_analysis_runs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.technical_analysis_runs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(12) NOT NULL,
    provider NVARCHAR(40) NOT NULL,
    trend NVARCHAR(20) NOT NULL,
    support DECIMAL(18,6) NOT NULL,
    resistance DECIMAL(18,6) NOT NULL,
    forecast_1m DECIMAL(18,6) NOT NULL,
    forecast_3m DECIMAL(18,6) NOT NULL,
    forecast_6m DECIMAL(18,6) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX idx_technical_analysis_runs_symbol_created ON dbo.technical_analysis_runs(symbol, created_at DESC);
END;

IF OBJECT_ID('dbo.api_call_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.api_call_log (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    provider NVARCHAR(40) NOT NULL,
    endpoint NVARCHAR(80) NOT NULL,
    symbol NVARCHAR(12) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX idx_api_call_log_provider_created ON dbo.api_call_log(provider, created_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE [key] = 'active_symbol')
  INSERT INTO dbo.settings ([key], [value]) VALUES ('active_symbol', 'AMD');

IF NOT EXISTS (SELECT 1 FROM dbo.watchlist WHERE symbol = 'AMD')
  INSERT INTO dbo.watchlist (symbol, name, note) VALUES ('AMD', 'Advanced Micro Devices, Inc.', 'Core watch');

IF NOT EXISTS (SELECT 1 FROM dbo.watchlist WHERE symbol = 'ARM')
  INSERT INTO dbo.watchlist (symbol, name, note) VALUES ('ARM', 'Arm Holdings plc', 'Semiconductor');

IF NOT EXISTS (SELECT 1 FROM dbo.watchlist WHERE symbol = 'NVDA')
  INSERT INTO dbo.watchlist (symbol, name, note) VALUES ('NVDA', 'NVIDIA Corp.', 'Momentum');
