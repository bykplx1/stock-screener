// analyze.ts - Comprehensive stock analysis script

import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { CacheManager } from '../utils/cache.js';
import { StockScorer } from '../utils/scoring.js';
import { logger, setLogLevel, LogLevel } from '../utils/logger.js';

const cache = new CacheManager();
const yahoo = new YahooFinanceClient(cache);
const scorer = new StockScorer();

async function analyzeStock(symbol: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  STOCK ANALYSIS: ${symbol.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch enhanced data (fundamentals + history + technicals)
  const result = await yahoo.fetchEnhanced(symbol.toUpperCase());

  if (!result.success || !result.data) {
    console.error(`Failed to fetch data for ${symbol}: ${result.error}`);
    return;
  }

  const data = result.data;
  const technicals = result.technicals;

  // Basic Info
  console.log('PRICE & MARKET DATA');
  console.log('-'.repeat(40));
  console.log(`  Price:            $${data.price?.toFixed(2) ?? 'N/A'}`);
  console.log(`  Market Cap:       ${formatMarketCap(data.market_cap)}`);
  console.log(`  Data Quality:     ${data.data_quality_score}/100`);
  console.log();

  // Valuation Metrics
  console.log('VALUATION METRICS');
  console.log('-'.repeat(40));
  console.log(`  P/E Ratio:        ${data.pe?.toFixed(2) ?? 'N/A'}`);
  console.log(`  PEG Ratio:        ${data.peg?.toFixed(2) ?? 'N/A'}`);
  console.log(`  FCF Yield:        ${data.fcf_yield ? (data.fcf_yield * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log();

  // Quality Metrics
  console.log('QUALITY METRICS');
  console.log('-'.repeat(40));
  console.log(`  ROE:              ${data.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`  ROIC (ROA):       ${data.roic ? (data.roic * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Gross Margin:     ${data.gross_margin ? (data.gross_margin * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Operating Margin: ${data.operating_margin ? (data.operating_margin * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log();

  // Health Metrics
  console.log('FINANCIAL HEALTH');
  console.log('-'.repeat(40));
  console.log(`  Debt/Equity:      ${data.debt_to_equity?.toFixed(2) ?? 'N/A'}`);
  console.log(`  Current Ratio:    ${data.current_ratio?.toFixed(2) ?? 'N/A'}`);
  console.log(`  Free Cash Flow:   ${data.free_cash_flow ? formatCurrency(data.free_cash_flow) : 'N/A'}`);
  console.log();

  // Growth Metrics
  console.log('GROWTH (5-YEAR CAGR)');
  console.log('-'.repeat(40));
  console.log(`  Revenue CAGR:     ${data.revenue_cagr_5y ? (data.revenue_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`  EPS CAGR:         ${data.eps_cagr_5y ? (data.eps_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log();

  // Technical Indicators
  if (technicals) {
    console.log('TECHNICAL INDICATORS');
    console.log('-'.repeat(40));
    console.log(`  RSI (14):         ${technicals.rsi_14?.toFixed(2) ?? 'N/A'}`);
    console.log(`  MACD:             ${technicals.macd?.toFixed(4) ?? 'N/A'}`);
    console.log(`  MACD Signal:      ${technicals.macd_signal?.toFixed(4) ?? 'N/A'}`);
    console.log(`  MACD Histogram:   ${technicals.macd_histogram?.toFixed(4) ?? 'N/A'}`);
    console.log(`  SMA (20):         $${technicals.sma_20?.toFixed(2) ?? 'N/A'}`);
    console.log(`  SMA (50):         $${technicals.sma_50?.toFixed(2) ?? 'N/A'}`);
    console.log(`  SMA (200):        $${technicals.sma_200?.toFixed(2) ?? 'N/A'}`);
    console.log(`  Bollinger Upper:  $${technicals.bollinger_upper?.toFixed(2) ?? 'N/A'}`);
    console.log(`  Bollinger Lower:  $${technicals.bollinger_lower?.toFixed(2) ?? 'N/A'}`);
    console.log(`  ATR (14):         $${technicals.atr_14?.toFixed(2) ?? 'N/A'}`);
    console.log();

    console.log('PRICE MOMENTUM');
    console.log('-'.repeat(40));
    console.log(`  1-Day Change:     ${technicals.price_change_1d?.toFixed(2) ?? 'N/A'}%`);
    console.log(`  5-Day Change:     ${technicals.price_change_5d?.toFixed(2) ?? 'N/A'}%`);
    console.log(`  20-Day Change:    ${technicals.price_change_20d?.toFixed(2) ?? 'N/A'}%`);
    console.log(`  Volume Ratio:     ${technicals.volume_ratio?.toFixed(2) ?? 'N/A'}x`);
    console.log();
  }

  // Calculate scores
  const scores = scorer.calculateScores(data, technicals);
  console.log('SCORES');
  console.log('-'.repeat(40));
  console.log(`  Valuation:        ${scores.valuation}/100 ${getScoreBar(scores.valuation)}`);
  console.log(`  Quality:          ${scores.quality}/100 ${getScoreBar(scores.quality)}`);
  console.log(`  Growth:           ${scores.growth}/100 ${getScoreBar(scores.growth)}`);
  console.log(`  Momentum:         ${scores.momentum}/100 ${getScoreBar(scores.momentum)}`);
  console.log(`  OVERALL:          ${scores.overall}/100 ${getScoreBar(scores.overall)}`);
  console.log();

  // Generate signals
  const signals = scorer.generateSignals(data, technicals);
  if (signals.length > 0) {
    console.log('SIGNALS');
    console.log('-'.repeat(40));
    for (const signal of signals) {
      const icon = signal.type === 'bullish' ? '🟢' : signal.type === 'bearish' ? '🔴' : '🟡';
      const strength = '★'.repeat(signal.strength) + '☆'.repeat(3 - signal.strength);
      console.log(`  ${icon} [${signal.indicator}] ${signal.message}`);
      console.log(`     Strength: ${strength}`);
    }
    console.log();
  }

  // Get recommendation
  const recommendation = scorer.getRecommendation(scores, signals);
  console.log('RECOMMENDATION');
  console.log('-'.repeat(40));
  console.log(`  Rating:           ${getRatingEmoji(recommendation.rating)} ${recommendation.rating}`);
  console.log(`  Confidence:       ${recommendation.confidence}%`);
  console.log(`  Summary:          ${recommendation.summary}`);
  console.log();

  // Cache stats
  const cacheStats = cache.getStats();
  console.log(`[Cache: ${cacheStats.entries} entries, ${(cacheStats.sizeBytes / 1024).toFixed(1)}KB]`);
}

function formatMarketCap(value: number | null): string {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
}

function getScoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
}

function getRatingEmoji(rating: string): string {
  switch (rating) {
    case 'Strong Buy': return '🚀';
    case 'Buy': return '📈';
    case 'Hold': return '➡️';
    case 'Sell': return '📉';
    case 'Strong Sell': return '🚨';
    default: return '❓';
  }
}

// Main
const symbol = process.argv[2];

if (!symbol) {
  console.log('Usage: npm run analyze <SYMBOL>');
  console.log('Example: npm run analyze AAPL');
  process.exit(1);
}

setLogLevel(LogLevel.WARN); // Reduce noise
analyzeStock(symbol).catch(console.error);
