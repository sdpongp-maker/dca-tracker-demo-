import sql from 'mssql';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Position, StockQuote, TechnicalSnapshot, WatchlistItem } from '@/types';

let poolPromise: Promise<sql.ConnectionPool> | null = null;
let schemaReady: Promise<void> | null = null;
let databaseReady: Promise<void> | null = null;

type DbEnv = {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

const env = readDbEnv();
const config: sql.config = buildConfig(env.database);

async function pool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    await ensureDatabase();
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

async function ensureDatabase(): Promise<void> {
  if (!databaseReady) {
    databaseReady = (async () => {
      const masterPool = await new sql.ConnectionPool(buildConfig('master')).connect();
      try {
        await masterPool.request()
          .input('database', sql.NVarChar(128), env.database)
          .query(`
            IF DB_ID(@database) IS NULL
            BEGIN
              DECLARE @sql nvarchar(max) = N'CREATE DATABASE ' + QUOTENAME(@database);
              EXEC (@sql);
            END
          `);
      } finally {
        await masterPool.close();
      }
    })();
  }
  return databaseReady;
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await pool();
      const schema = readFileSync(path.join(process.cwd(), 'src/lib/schema.sql'), 'utf8');
      await db.request().batch(schema);
    })();
  }
  return schemaReady;
}

export async function getActiveSymbol(): Promise<string> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request().query<{ value: string }>(
    "SELECT [value] FROM dbo.settings WHERE [key] = 'active_symbol'",
  );
  return normalizeSymbol(result.recordset[0]?.value ?? 'AMD');
}

export async function setActiveSymbol(symbol: string): Promise<string> {
  await ensureSchema();
  const normalized = normalizeSymbol(symbol);
  const db = await pool();
  await db.request()
    .input('symbol', sql.NVarChar(12), normalized)
    .query(`
      MERGE dbo.settings AS target
      USING (SELECT 'active_symbol' AS [key], @symbol AS [value]) AS src
      ON target.[key] = src.[key]
      WHEN MATCHED THEN UPDATE SET [value] = src.[value]
      WHEN NOT MATCHED THEN INSERT ([key], [value]) VALUES (src.[key], src.[value]);
    `);
  return normalized;
}

export async function listWatchlist(): Promise<WatchlistItem[]> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request().query<WatchlistItem>(`
    SELECT id, symbol, name, note, CONVERT(varchar(33), created_at, 126) AS created_at
    FROM dbo.watchlist
    ORDER BY created_at ASC, symbol ASC
  `);
  return result.recordset.map((row) => ({ ...row, symbol: normalizeSymbol(row.symbol) }));
}

export async function addWatchlist(symbol: string, name = '', note = ''): Promise<WatchlistItem> {
  await ensureSchema();
  const normalized = normalizeSymbol(symbol);
  const db = await pool();
  await db.request()
    .input('symbol', sql.NVarChar(12), normalized)
    .input('name', sql.NVarChar(120), name || normalized)
    .input('note', sql.NVarChar(240), note)
    .query(`
      MERGE dbo.watchlist AS target
      USING (SELECT @symbol AS symbol, @name AS name, @note AS note) AS src
      ON target.symbol = src.symbol
      WHEN MATCHED THEN UPDATE SET name = src.name, note = src.note
      WHEN NOT MATCHED THEN INSERT (symbol, name, note) VALUES (src.symbol, src.name, src.note);
    `);
  await setActiveSymbol(normalized);
  const result = await db.request()
    .input('symbol', sql.NVarChar(12), normalized)
    .query<WatchlistItem>(`
      SELECT id, symbol, name, note, CONVERT(varchar(33), created_at, 126) AS created_at
      FROM dbo.watchlist WHERE symbol = @symbol
    `);
  return result.recordset[0]!;
}

export async function deleteWatchlist(id: number): Promise<void> {
  await ensureSchema();
  const db = await pool();
  await db.request().input('id', sql.Int, id).query('DELETE FROM dbo.watchlist WHERE id = @id');
}

export async function listPositions(symbol: string): Promise<Position[]> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request()
    .input('symbol', sql.NVarChar(12), normalizeSymbol(symbol))
    .query<Position>(`
      SELECT
        id,
        symbol,
        CONVERT(varchar(10), trade_date, 23) AS [date],
        CONVERT(float, shares) AS shares,
        CONVERT(float, price) AS price,
        CONVERT(float, fees) AS fees,
        CONVERT(varchar(33), created_at, 126) AS created_at
      FROM dbo.positions
      WHERE symbol = @symbol
      ORDER BY trade_date ASC, id ASC
    `);
  return result.recordset.map((row) => ({ ...row, symbol: normalizeSymbol(row.symbol) }));
}

export async function insertPosition(input: Omit<Position, 'id' | 'created_at'>): Promise<Position> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request()
    .input('symbol', sql.NVarChar(12), normalizeSymbol(input.symbol))
    .input('date', sql.Date, input.date)
    .input('shares', sql.Decimal(18, 6), input.shares)
    .input('price', sql.Decimal(18, 6), input.price)
    .input('fees', sql.Decimal(18, 6), input.fees)
    .query<Position>(`
      INSERT INTO dbo.positions (symbol, trade_date, shares, price, fees)
      OUTPUT
        inserted.id,
        inserted.symbol,
        CONVERT(varchar(10), inserted.trade_date, 23) AS [date],
        CONVERT(float, inserted.shares) AS shares,
        CONVERT(float, inserted.price) AS price,
        CONVERT(float, inserted.fees) AS fees,
        CONVERT(varchar(33), inserted.created_at, 126) AS created_at
      VALUES (@symbol, @date, @shares, @price, @fees)
    `);
  await addWatchlist(input.symbol, input.symbol, 'Portfolio');
  return result.recordset[0]!;
}

export async function updatePosition(
  id: number,
  input: Pick<Position, 'shares' | 'price' | 'fees'>,
): Promise<Position | null> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request()
    .input('id', sql.Int, id)
    .input('shares', sql.Decimal(18, 6), input.shares)
    .input('price', sql.Decimal(18, 6), input.price)
    .input('fees', sql.Decimal(18, 6), input.fees)
    .query<Position>(`
      UPDATE dbo.positions
      SET shares = @shares, price = @price, fees = @fees
      OUTPUT
        inserted.id,
        inserted.symbol,
        CONVERT(varchar(10), inserted.trade_date, 23) AS [date],
        CONVERT(float, inserted.shares) AS shares,
        CONVERT(float, inserted.price) AS price,
        CONVERT(float, inserted.fees) AS fees,
        CONVERT(varchar(33), inserted.created_at, 126) AS created_at
      WHERE id = @id
    `);
  return result.recordset[0] ?? null;
}

export async function deletePosition(id: number): Promise<boolean> {
  await ensureSchema();
  const db = await pool();
  const result = await db.request().input('id', sql.Int, id).query('DELETE FROM dbo.positions WHERE id = @id');
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function saveMarketSnapshot(
  quote: StockQuote,
  technical: TechnicalSnapshot | null,
): Promise<void> {
  await ensureSchema();
  const db = await pool();
  await db.request()
    .input('symbol', sql.NVarChar(12), normalizeSymbol(quote.symbol))
    .input('provider', sql.NVarChar(40), quote.source)
    .input('price', sql.Decimal(18, 6), quote.price)
    .input('change', sql.Decimal(18, 6), quote.change)
    .input('changePct', sql.Decimal(18, 6), quote.changePct)
    .input('asOf', sql.NVarChar(40), quote.asOf)
    .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(quote))
    .query(`
      INSERT INTO dbo.stock_price_snapshots (symbol, provider, price, change_value, change_pct, as_of, payload)
      VALUES (@symbol, @provider, @price, @change, @changePct, @asOf, @payload)
    `);

  if (technical) {
    const one = technical.forecast.find((row) => row.horizon === '1M')?.price ?? quote.price;
    const three = technical.forecast.find((row) => row.horizon === '3M')?.price ?? quote.price;
    const six = technical.forecast.find((row) => row.horizon === '6M')?.price ?? quote.price;
    await db.request()
      .input('symbol', sql.NVarChar(12), normalizeSymbol(quote.symbol))
      .input('provider', sql.NVarChar(40), quote.source)
      .input('trend', sql.NVarChar(20), technical.trend)
      .input('support', sql.Decimal(18, 6), technical.support)
      .input('resistance', sql.Decimal(18, 6), technical.resistance)
      .input('one', sql.Decimal(18, 6), one)
      .input('three', sql.Decimal(18, 6), three)
      .input('six', sql.Decimal(18, 6), six)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify({ quote, technical }))
      .query(`
        INSERT INTO dbo.technical_analysis_runs
          (symbol, provider, trend, support, resistance, forecast_1m, forecast_3m, forecast_6m, payload)
        VALUES
          (@symbol, @provider, @trend, @support, @resistance, @one, @three, @six, @payload)
      `);
  }
}

export async function logApiCall(provider: string, endpoint: string, symbol: string, status: string): Promise<void> {
  try {
    await ensureSchema();
    const db = await pool();
    await db.request()
      .input('provider', sql.NVarChar(40), provider)
      .input('endpoint', sql.NVarChar(80), endpoint)
      .input('symbol', sql.NVarChar(12), normalizeSymbol(symbol))
      .input('status', sql.NVarChar(20), status)
      .query(`
        INSERT INTO dbo.api_call_log (provider, endpoint, symbol, status)
        VALUES (@provider, @endpoint, @symbol, @status)
      `);
  } catch {
    // Quota logging must never break market-data reads.
  }
}

export async function getApiCallCountToday(provider: string): Promise<number> {
  try {
    await ensureSchema();
    const db = await pool();
    const result = await db.request()
      .input('provider', sql.NVarChar(40), provider)
      .query<{ count: number }>(`
        SELECT COUNT(*) AS count
        FROM dbo.api_call_log
        WHERE provider = @provider
          AND CONVERT(date, created_at) = CONVERT(date, SYSUTCDATETIME())
      `);
    return Number(result.recordset[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z.-]/g, '').slice(0, 12) || 'AMD';
}

function buildConfig(database: string): sql.config {
  return {
    server: env.server,
    port: env.port,
    database,
    user: env.user,
    password: env.password,
    options: {
      encrypt: env.encrypt,
      trustServerCertificate: env.trustServerCertificate,
    },
    pool: {
      max: 8,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

function readDbEnv(): DbEnv {
  const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  return {
    server: process.env.DB_HOST ?? process.env.SQLSERVER_HOST ?? fromUrl.server ?? 'localhost',
    port: Number(process.env.DB_PORT ?? process.env.SQLSERVER_PORT ?? fromUrl.port ?? 1433),
    database: process.env.DB_NAME ?? process.env.SQLSERVER_DATABASE ?? fromUrl.database ?? 'stock_tracker',
    user: process.env.DB_USER ?? process.env.SQLSERVER_USER ?? fromUrl.user ?? 'sa',
    password:
      process.env.DB_PASSWORD
      ?? process.env.SQLSERVER_PASSWORD
      ?? process.env.MSSQL_SA_PASSWORD
      ?? fromUrl.password
      ?? 'YourStrong!Passw0rd',
    encrypt: toBool(process.env.DB_ENCRYPT ?? process.env.SQLSERVER_ENCRYPT ?? fromUrl.encrypt, true),
    trustServerCertificate: toBool(
      process.env.DB_TRUST_SERVER_CERTIFICATE
        ?? process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE
        ?? fromUrl.trustServerCertificate,
      true,
    ),
  };
}

function parseDatabaseUrl(value: string | undefined): Partial<DbEnv> {
  if (!value) return {};
  try {
    const url = new URL(value);
    const params = new Map<string, string>();
    for (const part of url.pathname.split(';')) {
      const [key, raw] = part.split('=');
      if (key && raw) params.set(key.toLowerCase(), raw);
    }
    for (const [key, raw] of url.searchParams.entries()) {
      params.set(key.toLowerCase(), raw);
    }
    const urlUser = url.username ? decodeURIComponent(url.username) : undefined;
    const urlPassword = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      server: url.hostname || undefined,
      port: url.port ? Number(url.port) : undefined,
      database: params.get('database') ?? undefined,
      user: params.get('user') ?? urlUser,
      password: params.get('password') ?? urlPassword,
      encrypt: params.has('encrypt') ? toBool(params.get('encrypt'), true) : undefined,
      trustServerCertificate: params.has('trustservercertificate')
        ? toBool(params.get('trustservercertificate'), true)
        : undefined,
    };
  } catch {
    return {};
  }
}

function toBool(value: string | boolean | undefined | null, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
