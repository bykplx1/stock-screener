# Stock Screener Backend v2.0

A comprehensive TypeScript backend for stock analysis with Yahoo Finance integration, local caching, technical indicators, scoring system, and signal generation.

## Features

- **Yahoo Finance Integration** - Fetch stock fundamentals and price history
- **Retry with Exponential Backoff** - Handles rate limiting gracefully
- **Local File-based Caching** - Reduces API calls, works offline
- **Technical Indicators** - RSI, MACD, SMA, EMA, Bollinger Bands, ATR
- **Scoring System** - Valuation, Quality, Growth, Momentum scores
- **Signal Generation** - Automatic bullish/bearish signals
- **Stock Screening** - Filter stocks by multiple criteria
- **Concurrent Fetching** - Faster batch operations
- **Progress Tracking** - Visual progress bars for long operations

## Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Supabase** account (optional, for database storage)

## Quick Start

```bash
# 1. Navigate to backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Configure environment (optional, for database features)
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Analyze a single stock
npm run analyze AAPL

# 5. Screen stocks with preset filters
npm run screen value
```

## Available Commands

### Analysis & Screening

```bash
# Analyze a single stock (comprehensive report)
npm run analyze <SYMBOL>
npm run analyze AAPL
npm run analyze MSFT

# Screen stocks using presets
npm run screen <preset>
npm run screen value         # Value investing criteria
npm run screen quality       # High quality companies
npm run screen growth-tech   # Growth tech stocks
npm run screen dividend-safe # Safe dividend payers
npm run screen oversold      # RSI oversold stocks
```

### Database Operations (requires Supabase)

```bash
# Fetch all stocks from database and update
npm run fetch

# Calculate VI scores
npm run scores
```

### Testing

```bash
npm run test:env       # Test environment config
npm run test:yahoo     # Test Yahoo Finance API
npm run test:db        # Test database connection
npm run test:fetch     # Test single stock fetch
npm run test:batch     # Test batch fetch
npm run test:pipeline  # Test full pipeline
```

### Cache Management

```bash
npm run cache:stats    # Show cache statistics
npm run cache:clear    # Clear all cached data
```

## File Structure

```
old/
├── .github/
│   └── workflows/
│       └── daily-update.yml    # GitHub Actions CI/CD
├── backend/
│   ├── .env                    # Environment variables (create from .env.example)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config/
│       │   └── env.ts          # Environment configuration
│       ├── types/
│       │   └── index.ts        # TypeScript type definitions
│       ├── utils/
│       │   ├── cache.ts        # File-based caching system
│       │   ├── data-transformer.ts
│       │   ├── logger.ts       # Logging utility
│       │   ├── scoring.ts      # Scoring and signal generation
│       │   ├── supabase-client.ts
│       │   ├── technical.ts    # Technical indicators (RSI, MACD, etc.)
│       │   └── yahoo-client.ts # Yahoo Finance API client
│       └── scripts/
│           ├── analyze.ts      # Single stock analysis
│           ├── calculate-scores.ts
│           ├── fetch-all-stocks.ts
│           ├── screen.ts       # Stock screening
│           ├── test-batch-fetch.ts
│           ├── test-db.ts
│           ├── test-env.ts
│           ├── test-fetch.ts
│           ├── test-full-pipeline.ts
│           └── test-yahoo.ts
└── README.md
```

## Technical Indicators

The system calculates these technical indicators:

| Indicator | Description |
|-----------|-------------|
| RSI (14) | Relative Strength Index |
| MACD | Moving Average Convergence Divergence |
| MACD Signal | 9-day EMA of MACD |
| MACD Histogram | MACD minus Signal |
| SMA (20, 50, 200) | Simple Moving Averages |
| EMA (20, 50) | Exponential Moving Averages |
| Bollinger Bands | Upper, Middle, Lower (20, 2) |
| ATR (14) | Average True Range |

## Scoring System

### Score Categories (0-100)

- **Valuation Score** - Based on P/E, PEG, FCF Yield
- **Quality Score** - Based on ROE, margins, debt, current ratio
- **Growth Score** - Based on revenue and EPS CAGR
- **Momentum Score** - Based on RSI, MACD, price changes

### Overall Score Weighting

```
Overall = Valuation × 0.25 + Quality × 0.30 + Growth × 0.25 + Momentum × 0.20
```

## Environment Variables

For database features, create `backend/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

## Working from Another PC

To use this project on another computer:

1. **Copy the entire `old/` folder** to your new PC
2. **Navigate to backend**: `cd old/backend`
3. **Install dependencies**: `npm install`
4. **Create `.env` file** with your Supabase credentials (if using database)
5. **Run any command**: `npm run analyze AAPL`

**No code changes needed** - all paths are relative.

## Troubleshooting

**Rate limiting errors:**
- The system auto-retries with exponential backoff
- Reduce concurrency if issues persist

**Cache issues:**
- Run `npm run cache:clear` to reset
- Delete `.cache/` folder manually if needed

**Yahoo Finance API changes:**
- Historical statement data may be limited (Yahoo changed in Nov 2024)
- Basic metrics still work reliably
