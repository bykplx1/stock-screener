// screen.ts - Stock screening with filters

import { YahooFinanceClient, type EnhancedFetchResult } from '../utils/yahoo-client.js';
import { CacheManager } from '../utils/cache.js';
import { StockScorer, type ScoreBreakdown } from '../utils/scoring.js';
import { logger, setLogLevel, LogLevel } from '../utils/logger.js';

// Popular stock lists for screening
const STOCK_LISTS = {
  'sp500-sample': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ',
                   'V', 'XOM', 'JPM', 'PG', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'PFE'],
  'tech': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'CRM',
           'AMD', 'ADBE', 'INTC', 'CSCO', 'QCOM', 'TXN', 'IBM', 'NOW', 'AMAT', 'MU'],
  'finance': ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BLK', 'SCHW', 'USB'],
  'healthcare': ['UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY'],
  'dividend': ['JNJ', 'PG', 'KO', 'PEP', 'MCD', 'WMT', 'HD', 'VZ', 'T', 'XOM'],
};

interface ScreenResult {
  symbol: string;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  roe: number | null;
  scores: ScoreBreakdown;
  recommendation: string;
  matchedFilters: string[];
}

interface FilterCriteria {
  minScore?: number;
  maxPE?: number;
  minROE?: number;
  minMarketCap?: number;
  maxDebtToEquity?: number;
  minCurrentRatio?: number;
  rsiOversold?: boolean;
  rsiOverbought?: boolean;
}

const cache = new CacheManager();
const yahoo = new YahooFinanceClient(cache);
const scorer = new StockScorer();

async function screenStocks(
  symbols: string[],
  filters: FilterCriteria
): Promise<ScreenResult[]> {
  const results: ScreenResult[] = [];
  let processed = 0;

  console.log(`\nScreening ${symbols.length} stocks...\n`);

  // Batch fetch all stocks
  const fetchResults = await yahoo.batchFetch(symbols, {
    concurrency: 3,
    includeHistory: true,
    progressCallback: (completed, total, symbol) => {
      const progress = ((completed / total) * 100).toFixed(0);
      process.stdout.write(`\rProgress: ${progress}% (${completed}/${total}) - ${symbol}     `);
    }
  });

  console.log('\n\nApplying filters...\n');

  for (const result of fetchResults) {
    if (!result.success || !result.data) continue;

    const data = result.data;
    const technicals = result.technicals;
    const scores = scorer.calculateScores(data, technicals);
    const matchedFilters: string[] = [];

    // Apply filters
    let passes = true;

    if (filters.minScore !== undefined) {
      if (scores.overall >= filters.minScore) {
        matchedFilters.push(`Score >= ${filters.minScore}`);
      } else {
        passes = false;
      }
    }

    if (filters.maxPE !== undefined && data.pe !== null) {
      if (data.pe > 0 && data.pe <= filters.maxPE) {
        matchedFilters.push(`P/E <= ${filters.maxPE}`);
      } else {
        passes = false;
      }
    }

    if (filters.minROE !== undefined && data.roe !== null) {
      if (data.roe >= filters.minROE) {
        matchedFilters.push(`ROE >= ${(filters.minROE * 100).toFixed(0)}%`);
      } else {
        passes = false;
      }
    }

    if (filters.minMarketCap !== undefined && data.market_cap !== null) {
      if (data.market_cap >= filters.minMarketCap) {
        matchedFilters.push(`Market Cap >= $${(filters.minMarketCap / 1e9).toFixed(0)}B`);
      } else {
        passes = false;
      }
    }

    if (filters.maxDebtToEquity !== undefined && data.debt_to_equity !== null) {
      if (data.debt_to_equity <= filters.maxDebtToEquity) {
        matchedFilters.push(`D/E <= ${filters.maxDebtToEquity}`);
      } else {
        passes = false;
      }
    }

    if (filters.minCurrentRatio !== undefined && data.current_ratio !== null) {
      if (data.current_ratio >= filters.minCurrentRatio) {
        matchedFilters.push(`Current Ratio >= ${filters.minCurrentRatio}`);
      } else {
        passes = false;
      }
    }

    if (filters.rsiOversold && technicals?.rsi_14 !== null) {
      if (technicals!.rsi_14! < 30) {
        matchedFilters.push('RSI Oversold (<30)');
      } else {
        passes = false;
      }
    }

    if (filters.rsiOverbought && technicals?.rsi_14 !== null) {
      if (technicals!.rsi_14! > 70) {
        matchedFilters.push('RSI Overbought (>70)');
      } else {
        passes = false;
      }
    }

    if (passes) {
      const signals = scorer.generateSignals(data, technicals);
      const recommendation = scorer.getRecommendation(scores, signals);

      results.push({
        symbol: result.symbol,
        price: data.price,
        marketCap: data.market_cap,
        pe: data.pe,
        roe: data.roe,
        scores,
        recommendation: recommendation.rating,
        matchedFilters,
      });
    }
  }

  // Sort by overall score
  results.sort((a, b) => b.scores.overall - a.scores.overall);

  return results;
}

function printResults(results: ScreenResult[]): void {
  if (results.length === 0) {
    console.log('No stocks matched the criteria.\n');
    return;
  }

  console.log('╔════════╤══════════╤══════════╤═══════╤═══════╤═══════╤═════════════╗');
  console.log('║ Symbol │   Price  │ Mkt Cap  │  P/E  │  ROE  │ Score │ Recommend   ║');
  console.log('╠════════╪══════════╪══════════╪═══════╪═══════╪═══════╪═════════════╣');

  for (const r of results) {
    const price = r.price ? `$${r.price.toFixed(2)}`.padStart(8) : 'N/A'.padStart(8);
    const cap = r.marketCap ? formatCap(r.marketCap).padStart(8) : 'N/A'.padStart(8);
    const pe = r.pe ? r.pe.toFixed(1).padStart(5) : 'N/A'.padStart(5);
    const roe = r.roe ? `${(r.roe * 100).toFixed(0)}%`.padStart(5) : 'N/A'.padStart(5);
    const score = r.scores.overall.toString().padStart(5);
    const rec = r.recommendation.padEnd(11);

    console.log(`║ ${r.symbol.padEnd(6)} │ ${price} │ ${cap} │ ${pe} │ ${roe} │ ${score} │ ${rec} ║`);
  }

  console.log('╚════════╧══════════╧══════════╧═══════╧═══════╧═══════╧═════════════╝');
  console.log(`\nTotal: ${results.length} stocks matched\n`);
}

function formatCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

// Preset screens
const PRESETS: Record<string, { list: keyof typeof STOCK_LISTS; filters: FilterCriteria }> = {
  'value': {
    list: 'sp500-sample',
    filters: { maxPE: 20, minROE: 0.10, maxDebtToEquity: 1.0 }
  },
  'quality': {
    list: 'sp500-sample',
    filters: { minScore: 60, minROE: 0.15, minCurrentRatio: 1.5 }
  },
  'growth-tech': {
    list: 'tech',
    filters: { minScore: 55, minMarketCap: 50e9 }
  },
  'dividend-safe': {
    list: 'dividend',
    filters: { maxDebtToEquity: 0.5, minCurrentRatio: 1.2 }
  },
  'oversold': {
    list: 'sp500-sample',
    filters: { rsiOversold: true }
  },
};

// Main
async function main(): Promise<void> {
  const preset = process.argv[2];

  if (!preset || !PRESETS[preset]) {
    console.log('\nUsage: npm run screen <preset>\n');
    console.log('Available presets:');
    for (const [name, config] of Object.entries(PRESETS)) {
      console.log(`  ${name.padEnd(15)} - Screen ${config.list} with ${JSON.stringify(config.filters)}`);
    }
    console.log('\nExample: npm run screen value\n');
    process.exit(1);
  }

  const config = PRESETS[preset];
  const symbols = STOCK_LISTS[config.list];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║          STOCK SCREENER - ${preset.toUpperCase().padEnd(28)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nFilters: ${JSON.stringify(config.filters)}`);

  setLogLevel(LogLevel.WARN);

  const results = await screenStocks(symbols, config.filters);
  printResults(results);

  // Show top picks details
  if (results.length > 0) {
    console.log('TOP 3 DETAILED BREAKDOWN:\n');
    for (const r of results.slice(0, 3)) {
      console.log(`${r.symbol}:`);
      console.log(`  Valuation: ${r.scores.valuation} | Quality: ${r.scores.quality} | Growth: ${r.scores.growth} | Momentum: ${r.scores.momentum}`);
      console.log(`  Matched: ${r.matchedFilters.join(', ')}`);
      console.log();
    }
  }
}

main().catch(console.error);
