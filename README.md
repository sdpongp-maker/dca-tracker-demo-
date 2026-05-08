# US Stock Tracker

Local-first dashboard for US stock watchlists, technical swing-trade signals, and portfolio/DCA tracking.

The UI keeps the original DCA Tracker layout, but the data model now targets US equities:

- Search a US stock symbol and load a delayed public quote
- Watchlist stored locally in SQL Server
- Candlestick chart with MA20, MA50, RSI 14, and MACD
- Rule-based technical signal with Buy / Sell / Hold bias
- Portfolio lot tracking with shares, entry price, fees, average cost, unrealized P/L, and DCA target price

> Market data uses Twelve Data for quote/candles, FMP for historical EOD fallback, and Stooq only as a last no-key fallback. Treat the technical signal as decision support, not financial advice.

## Requirements

| Software | Minimum |
|---|---|
| Node.js | 20 LTS |
| npm | included with Node |
| SQL Server / Azure SQL Edge | running locally |

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:1080](http://localhost:1080).

The app connects to your already-running local SQL Server or Azure SQL Edge instance on port `1433`. If `stock_tracker` does not exist, the app connects through `master` and creates it automatically. On first request it also creates these tables:

- `watchlist`
- `positions`
- `settings`

## Useful Commands

```bash
npm run dev        # Next.js dev server on port 1080
npm run build      # production build check
npm run lint       # ESLint
npm run typecheck  # TypeScript check
```

## Environment

```env
DATABASE_URL="sqlserver://localhost:1433;database=stock_tracker;user=sa;password=lSBqDnzqWOkxE8N;encrypt=true;trustServerCertificate=true"
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=lSBqDnzqWOkxE8N
DB_NAME=stock_tracker
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
TWELVE_DATA_API_KEY=
FMP_API_KEY=
```

## Stack

- Next.js App Router + TypeScript
- SQL Server / Azure SQL Edge local connection
- `mssql` Node client
- Tailwind CSS
- Twelve Data + FMP market data APIs
