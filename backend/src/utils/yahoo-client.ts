// backend/src/utils/yahoo-client.ts
import YahooFinance from 'yahoo-finance2';
import type { StockSnapshot, FetchResult } from '../types/index.js';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

export class YahooFinanceClient {

  async fetchBasicMetrics(symbol: string): Promise<StockSnapshot | null> {
  try {
    const q = await yahooFinance.quote(symbol);

    if (!q?.regularMarketPrice) return null;

    return {
      symbol,
      snapshot_date: new Date().toISOString().split('T')[0],

      // Price
      price: q.regularMarketPrice ?? null,
      market_cap: q.marketCap ?? null,

      // We leave these empty for now
      pe: q.trailingPE ?? null,
      roe: null,
      roic: null,
      gross_margin: null,
      operating_margin: null,
      debt_to_equity: null,
      current_ratio: null,
      free_cash_flow: null,
      revenue_cagr_5y: null,
      eps_cagr_5y: null,
      peg: null,
      fcf_yield: null,

      data_quality_score: this.calculateMvpDataQuality(q)
    };

    } catch (err) {
      console.error(`Error fetching ${symbol}:`, err);
      return null;
    }
  }

  
  // give up on these methods for now
  // =========================================================================
  // async fetchBasicMetrics(symbol: string): Promise<StockSnapshot | null> {
  //   try {
  //     const data = await yahooFinance.quoteSummary(symbol, {
  //       modules: [
  //         'price',
  //         'summaryDetail',
  //         'defaultKeyStatistics',
  //         'financialData'        
  //       ]
  //     });

  //     return this.transformData(symbol, data);
      
  //   } catch (error) {
  //     console.error(`Error fetching ${symbol} from fetchBasicMetrics:`, error instanceof Error ? error.message : 'Unknown error');
  //     return null;
  //   }
  // }

  // async fetchFinancials(symbol: string): Promise<StockSnapshot | null> {
  //   try {
  //     const fundamentals = await yahooFinance.fundamentalsTimeSeries(symbol, {
  //       periodType: 'annual',
  //       type: [
  //         'totalRevenue',
  //         'netIncome',
  //         'freeCashFlow',
  //         'weightedAverageSharesOutstanding'
  //       ]
  //     });

  //     return this.transformData(symbol, fundamentals);
      
  //   } catch (error) {
  //     console.error(`Error fetching ${symbol} from fetchFinancials:`, error instanceof Error ? error.message : 'Unknown error');
  //     return null;
  //   }
  // }
  // =========================================================================

  private calculateMvpDataQuality(q: any): number {
    let score = 0;

    if (q.regularMarketPrice != null) score += 40;
    if (q.marketCap != null) score += 30;
    if (q.trailingPE != null) score += 15;
    if (q.fiftyTwoWeekHigh != null && q.fiftyTwoWeekLow != null) score += 15;

    return score;
  }

  private transformData(symbol: string, data: any): StockSnapshot {
    const price = data.price;
    const financial = data.financialData;
    const stats = data.defaultKeyStatistics;
    const summary = data.summaryDetail;
    
    // Get historical data for CAGR calculations
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
    const marketCap = price?.marketCap?.raw;
    const fcfYield = (fcf && marketCap) ? fcf / marketCap : null;

    return {
      symbol,
      snapshot_date: new Date().toISOString().split('T')[0],
      
      // Quality metrics
      roe: financial?.returnOnEquity?.raw ?? null,
      roic: financial?.returnOnAssets?.raw ?? null,
      gross_margin: financial?.grossMargins?.raw ?? null,
      operating_margin: financial?.operatingMargins?.raw ?? null,
      
      // Health metrics
      debt_to_equity: financial?.debtToEquity?.raw ? financial.debtToEquity.raw / 100 : null,
      current_ratio: financial?.currentRatio?.raw ?? null,
      free_cash_flow: fcf ?? null,
      
      // Growth metrics
      revenue_cagr_5y: revenueCAGR,
      eps_cagr_5y: epsCAGR,
      
      // Valuation metrics
      pe: summary?.trailingPE?.raw ?? null,
      peg: stats?.pegRatio?.raw ?? null,
      fcf_yield: fcfYield,
      
      // Price data
      price: price?.regularMarketPrice?.raw ?? null,
      market_cap: marketCap ?? null,
      
      // Metadata
      data_quality_score: this.calculateDataQuality(financial, incomeHistory)
    };
  }

  /**
   * Calculate Compound Annual Growth Rate
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
   * Calculate data quality score (0-100)
   */
  private calculateDataQuality(financial: any, incomeHistory: any[]): number {
    let score = 0;
    
    const checks = [
      financial?.returnOnEquity?.raw !== null && financial?.returnOnEquity?.raw !== undefined,
      financial?.operatingMargins?.raw !== null && financial?.operatingMargins?.raw !== undefined,
      financial?.debtToEquity?.raw !== null && financial?.debtToEquity?.raw !== undefined,
      incomeHistory?.length >= 5,
      financial?.currentRatio?.raw !== null && financial?.currentRatio?.raw !== undefined
    ];
    
    checks.forEach(check => {
      if (check) score += 20;
    });
    
    return score;
  }

  /**
   * Batch fetch multiple stocks with rate limiting
   */
  async batchFetch(symbols: string[], delayMs: number = 1000): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      
      console.log(`[${i + 1}/${symbols.length}] Fetching ${symbol}...`);
      
      const data = await this.fetchBasicMetrics(symbol);
      
      if (data) {
        results.push({ success: true, symbol, data });
        console.log(`   ✅ Success (ROE: ${data.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'})`);
      } else {
        results.push({ success: false, symbol, error: 'Failed to fetch' });
        console.log(`   ❌ Failed`);
      }
      
      // Rate limiting
      if (i < symbols.length - 1) {
        await this.sleep(delayMs);
      }
    }
    
    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}