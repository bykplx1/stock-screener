// yahoo-client.ts - Yahoo Finance client with retry, caching, and concurrent fetching

import YahooFinance from 'yahoo-finance2';
import type { StockSnapshot, FetchResult } from '../types/index.js';
import { CacheManager } from './cache.js';
import { logger } from './logger.js';
import { TechnicalAnalyzer, type PriceBar, type TechnicalIndicators } from './technical.js';

// Configuration
const REQUEST_DELAY_MS = 200;  // 200ms between requests
const MAX_RETRIES = 3;
const CACHE_TTL_SECONDS = 3600; // 1 hour
const HISTORY_CACHE_TTL = 1800; // 30 minutes

export interface FetchOptions {
  useCache?: boolean;
  retries?: number;
  includeHistory?: boolean;
}

export interface EnhancedFetchResult extends FetchResult {
  technicals?: TechnicalIndicators;
  history?: PriceBar[];
  fromCache?: boolean;
}

export class YahooFinanceClient {
  private yf: InstanceType<typeof YahooFinance>;
  private cache: CacheManager | null;
  private lastRequestTime: number = 0;

  constructor(cache?: CacheManager) {
    this.yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
    this.cache = cache || null;
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      await this.sleep(REQUEST_DELAY_MS - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  private async fetchWithRetry<T>(
    operation: () => Promise<T>,
    symbol: string,
    maxRetries: number = MAX_RETRIES
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.rateLimit();
        return await operation();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Check for rate limiting
        if (errorMsg.includes('Too Many Requests') || errorMsg.includes('Rate')) {
          const waitTime = attempt * 5000; // 5s, 10s, 15s
          logger.warn(`Rate limited for ${symbol}, waiting ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`);
          await this.sleep(waitTime);

          if (attempt === maxRetries) {
            logger.error(`Failed to fetch ${symbol} after ${maxRetries} retries: ${errorMsg}`);
            return null;
          }
        } else {
          logger.error(`Error fetching ${symbol}: ${errorMsg}`);
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Fetch comprehensive stock data including fundamentals
   */
  async fetchBasicMetrics(symbol: string, options: FetchOptions = {}): Promise<StockSnapshot | null> {
    const { useCache = true, retries = MAX_RETRIES } = options;
    const cacheKey = `stock_basic_${symbol}`;

    // Check cache first
    if (useCache && this.cache) {
      const cached = this.cache.get<StockSnapshot>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ${symbol}`);
        return cached;
      }
    }

    const data = await this.fetchWithRetry(async () => {
      const result = await this.yf.quoteSummary(symbol, {
        modules: ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics']
      });
      return this.transformQuoteSummary(symbol, result);
    }, symbol, retries);

    // Cache the result
    if (data && useCache && this.cache) {
      this.cache.set(cacheKey, data, CACHE_TTL_SECONDS);
    }

    return data;
  }

  /**
   * Fetch with historical data for CAGR calculations (more complete)
   */
  async fetchCompleteMetrics(symbol: string, options: FetchOptions = {}): Promise<StockSnapshot | null> {
    const { useCache = true, retries = MAX_RETRIES } = options;
    const cacheKey = `stock_complete_${symbol}`;

    // Check cache first
    if (useCache && this.cache) {
      const cached = this.cache.get<StockSnapshot>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ${symbol} (complete)`);
        return cached;
      }
    }

    const data = await this.fetchWithRetry(async () => {
      const result = await this.yf.quoteSummary(symbol, {
        modules: [
          'price',
          'summaryDetail',
          'financialData',
          'defaultKeyStatistics',
          'incomeStatementHistory',
          'cashflowStatementHistory'
        ]
      });
      return this.transformCompleteData(symbol, result);
    }, symbol, retries);

    // If complete fetch failed, try basic
    if (!data) {
      logger.warn(`Complete fetch failed for ${symbol}, falling back to basic`);
      return this.fetchBasicMetrics(symbol, options);
    }

    // Cache the result
    if (data && useCache && this.cache) {
      this.cache.set(cacheKey, data, CACHE_TTL_SECONDS);
    }

    return data;
  }

  /**
   * Fetch historical price data
   */
  async fetchHistory(
    symbol: string,
    period: string = '1y',
    interval: string = '1d',
    options: FetchOptions = {}
  ): Promise<PriceBar[] | null> {
    const { useCache = true } = options;
    const cacheKey = `history_${symbol}_${period}_${interval}`;

    // Check cache first
    if (useCache && this.cache) {
      const cached = this.cache.get<PriceBar[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ${symbol} history`);
        return cached;
      }
    }

    const history = await this.fetchWithRetry(async () => {
      const result = await this.yf.chart(symbol, {
        period1: this.getPeriodStart(period),
        interval: interval as any
      });

      if (!result.quotes || result.quotes.length === 0) {
        return null;
      }

      return result.quotes.map((q: any) => ({
        date: new Date(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
      }));
    }, symbol);

    // Cache the result
    if (history && useCache && this.cache) {
      this.cache.set(cacheKey, history, HISTORY_CACHE_TTL);
    }

    return history;
  }

  private getPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1mo': return new Date(now.setMonth(now.getMonth() - 1));
      case '3mo': return new Date(now.setMonth(now.getMonth() - 3));
      case '6mo': return new Date(now.setMonth(now.getMonth() - 6));
      case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
      case '2y': return new Date(now.setFullYear(now.getFullYear() - 2));
      case '5y': return new Date(now.setFullYear(now.getFullYear() - 5));
      default: return new Date(now.setFullYear(now.getFullYear() - 1));
    }
  }

  /**
   * Fetch stock with technical indicators
   */
  async fetchEnhanced(symbol: string, options: FetchOptions = {}): Promise<EnhancedFetchResult> {
    const [snapshot, history] = await Promise.all([
      this.fetchCompleteMetrics(symbol, options),
      options.includeHistory !== false ? this.fetchHistory(symbol) : Promise.resolve(null)
    ]);

    if (!snapshot) {
      return { success: false, symbol, error: 'Failed to fetch data' };
    }

    let technicals: TechnicalIndicators | undefined;
    if (history && history.length >= 50) {
      const analyzer = new TechnicalAnalyzer(history);
      technicals = analyzer.calculateAll();
    }

    return {
      success: true,
      symbol,
      data: snapshot,
      technicals,
      history: history || undefined,
    };
  }

  /**
   * Batch fetch multiple stocks concurrently
   */
  async batchFetch(
    symbols: string[],
    options: {
      concurrency?: number;
      useComplete?: boolean;
      includeHistory?: boolean;
      progressCallback?: (completed: number, total: number, symbol: string) => void;
    } = {}
  ): Promise<EnhancedFetchResult[]> {
    const { concurrency = 5, useComplete = true, includeHistory = true, progressCallback } = options;
    const results: EnhancedFetchResult[] = [];
    let completed = 0;

    // Process in batches for controlled concurrency
    for (let i = 0; i < symbols.length; i += concurrency) {
      const batch = symbols.slice(i, i + concurrency);

      const batchPromises = batch.map(async (symbol) => {
        const result = await this.fetchEnhanced(symbol, {
          useCache: true,
          includeHistory: includeHistory
        });

        completed++;
        if (progressCallback) {
          progressCallback(completed, symbols.length, symbol);
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + concurrency < symbols.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Transform quoteSummary data (basic metrics only)
   */
  private transformQuoteSummary(symbol: string, data: any): StockSnapshot {
    const price = data.price;
    const financial = data.financialData;
    const stats = data.defaultKeyStatistics;
    const summary = data.summaryDetail;

    return {
      symbol,
      snapshot_date: new Date().toISOString().split('T')[0],

      // Price data
      price: price?.regularMarketPrice ?? null,
      market_cap: price?.marketCap ?? null,

      // Valuation
      pe: summary?.trailingPE ?? null,
      peg: stats?.pegRatio ?? null,
      fcf_yield: null,

      // Quality metrics
      roe: financial?.returnOnEquity ?? null,
      roic: financial?.returnOnAssets ?? null,
      gross_margin: financial?.grossMargins ?? null,
      operating_margin: financial?.operatingMargins ?? null,

      // Health metrics
      debt_to_equity: financial?.debtToEquity ? financial.debtToEquity / 100 : null,
      current_ratio: financial?.currentRatio ?? null,
      free_cash_flow: financial?.freeCashflow ?? null,

      // Growth metrics (not available without historical data)
      revenue_cagr_5y: null,
      eps_cagr_5y: null,

      // Metadata
      data_quality_score: this.calculateBasicDataQuality(financial, price)
    };
  }

  /**
   * Transform complete data including historical statements
   */
  private transformCompleteData(symbol: string, data: any): StockSnapshot {
    const price = data.price;
    const financial = data.financialData;
    const stats = data.defaultKeyStatistics;
    const summary = data.summaryDetail;

    // Historical data (note: Yahoo may return empty since Nov 2024)
    const incomeHistory = data.incomeStatementHistory?.incomeStatementHistory || [];
    const cashflowHistory = data.cashflowStatementHistory?.cashflowStatements || [];

    // Calculate revenue CAGR (5 years)
    const revenueCAGR = this.calculateCAGR(
      incomeHistory[4]?.totalRevenue?.raw,
      incomeHistory[0]?.totalRevenue?.raw,
      5
    );

    // Calculate EPS CAGR (5 years)
    const epsOld = incomeHistory[4]?.netIncome?.raw && incomeHistory[4]?.weightedAverageShsOut?.raw
      ? incomeHistory[4].netIncome.raw / incomeHistory[4].weightedAverageShsOut.raw
      : null;

    const epsNew = incomeHistory[0]?.netIncome?.raw && incomeHistory[0]?.weightedAverageShsOut?.raw
      ? incomeHistory[0].netIncome.raw / incomeHistory[0].weightedAverageShsOut.raw
      : null;

    const epsCAGR = this.calculateCAGR(epsOld, epsNew, 5);

    // Calculate FCF Yield
    const fcf = cashflowHistory[0]?.freeCashflow?.raw;
    const marketCap = price?.marketCap;
    const fcfYield = (fcf && marketCap) ? fcf / marketCap : null;

    return {
      symbol,
      snapshot_date: new Date().toISOString().split('T')[0],

      // Price data
      price: price?.regularMarketPrice ?? null,
      market_cap: marketCap ?? null,

      // Valuation
      pe: summary?.trailingPE ?? null,
      peg: stats?.pegRatio ?? null,
      fcf_yield: fcfYield,

      // Quality metrics
      roe: financial?.returnOnEquity ?? null,
      roic: financial?.returnOnAssets ?? null,
      gross_margin: financial?.grossMargins ?? null,
      operating_margin: financial?.operatingMargins ?? null,

      // Health metrics
      debt_to_equity: financial?.debtToEquity ? financial.debtToEquity / 100 : null,
      current_ratio: financial?.currentRatio ?? null,
      free_cash_flow: fcf ?? null,

      // Growth metrics
      revenue_cagr_5y: revenueCAGR,
      eps_cagr_5y: epsCAGR,

      // Metadata
      data_quality_score: this.calculateCompleteDataQuality(financial, incomeHistory)
    };
  }

  /**
   * Calculate CAGR
   */
  private calculateCAGR(
    startValue: number | null | undefined,
    endValue: number | null | undefined,
    years: number
  ): number | null {
    if (!startValue || !endValue || startValue <= 0 || endValue <= 0) {
      return null;
    }
    return Math.pow(endValue / startValue, 1 / years) - 1;
  }

  /**
   * Calculate data quality score for basic metrics
   */
  private calculateBasicDataQuality(financial: any, price: any): number {
    let score = 0;

    if (price?.regularMarketPrice != null) score += 20;
    if (price?.marketCap != null) score += 20;
    if (financial?.returnOnEquity != null) score += 15;
    if (financial?.grossMargins != null) score += 15;
    if (financial?.operatingMargins != null) score += 15;
    if (financial?.currentRatio != null) score += 15;

    return score;
  }

  /**
   * Calculate data quality score for complete data
   */
  private calculateCompleteDataQuality(financial: any, incomeHistory: any[]): number {
    let score = 0;

    const checks = [
      financial?.returnOnEquity !== null && financial?.returnOnEquity !== undefined,
      financial?.operatingMargins !== null && financial?.operatingMargins !== undefined,
      financial?.debtToEquity !== null && financial?.debtToEquity !== undefined,
      incomeHistory?.length >= 5,
      financial?.currentRatio !== null && financial?.currentRatio !== undefined
    ];

    checks.forEach(check => {
      if (check) score += 20;
    });

    return score;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
