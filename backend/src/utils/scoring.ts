// scoring.ts - Stock scoring and signal generation

import type { StockSnapshot } from '../types/index.js';
import type { TechnicalIndicators } from './technical.js';

export interface ScoreBreakdown {
  valuation: number;
  quality: number;
  growth: number;
  momentum: number;
  overall: number;
}

export interface Signal {
  type: 'bullish' | 'bearish' | 'neutral';
  indicator: string;
  message: string;
  strength: number; // 1-3
}

export class StockScorer {
  /**
   * Calculate comprehensive scores for a stock
   */
  calculateScores(
    snapshot: StockSnapshot,
    technicals?: TechnicalIndicators
  ): ScoreBreakdown {
    const valuation = this.getValuationScore(snapshot);
    const quality = this.getQualityScore(snapshot);
    const growth = this.getGrowthScore(snapshot);
    const momentum = technicals ? this.getMomentumScore(technicals) : 50;

    // Weighted overall score
    const overall =
      valuation * 0.25 +
      quality * 0.30 +
      growth * 0.25 +
      momentum * 0.20;

    return {
      valuation: Math.round(valuation),
      quality: Math.round(quality),
      growth: Math.round(growth),
      momentum: Math.round(momentum),
      overall: Math.round(overall),
    };
  }

  /**
   * Valuation score based on P/E, PEG, FCF Yield
   */
  getValuationScore(snapshot: StockSnapshot): number {
    let score = 50;

    // P/E ratio scoring
    if (snapshot.pe != null) {
      if (snapshot.pe < 0) score -= 10;
      else if (snapshot.pe < 10) score += 15;
      else if (snapshot.pe < 15) score += 10;
      else if (snapshot.pe < 20) score += 5;
      else if (snapshot.pe < 30) score -= 5;
      else score -= 10;
    }

    // PEG ratio scoring
    if (snapshot.peg != null) {
      if (snapshot.peg < 0) score -= 5;
      else if (snapshot.peg < 1) score += 15;
      else if (snapshot.peg < 1.5) score += 10;
      else if (snapshot.peg < 2) score += 5;
      else if (snapshot.peg > 3) score -= 10;
    }

    // FCF Yield scoring
    if (snapshot.fcf_yield != null) {
      const fcfYieldPct = snapshot.fcf_yield * 100;
      if (fcfYieldPct > 10) score += 15;
      else if (fcfYieldPct > 5) score += 10;
      else if (fcfYieldPct > 3) score += 5;
      else if (fcfYieldPct < 0) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Quality score based on margins, ROE, debt
   */
  getQualityScore(snapshot: StockSnapshot): number {
    let score = 50;

    // ROE scoring
    if (snapshot.roe != null) {
      const roePct = snapshot.roe * 100;
      if (roePct > 25) score += 15;
      else if (roePct > 15) score += 10;
      else if (roePct > 10) score += 5;
      else if (roePct < 0) score -= 15;
      else if (roePct < 5) score -= 5;
    }

    // Operating margin scoring
    if (snapshot.operating_margin != null) {
      const margin = snapshot.operating_margin * 100;
      if (margin > 25) score += 10;
      else if (margin > 15) score += 5;
      else if (margin < 0) score -= 10;
      else if (margin < 5) score -= 5;
    }

    // Gross margin scoring
    if (snapshot.gross_margin != null) {
      const margin = snapshot.gross_margin * 100;
      if (margin > 50) score += 10;
      else if (margin > 30) score += 5;
      else if (margin < 20) score -= 5;
    }

    // Debt-to-equity scoring
    if (snapshot.debt_to_equity != null) {
      if (snapshot.debt_to_equity < 0.3) score += 15;
      else if (snapshot.debt_to_equity < 0.5) score += 10;
      else if (snapshot.debt_to_equity < 1) score += 5;
      else if (snapshot.debt_to_equity > 2) score -= 10;
      else if (snapshot.debt_to_equity > 1.5) score -= 5;
    }

    // Current ratio scoring
    if (snapshot.current_ratio != null) {
      if (snapshot.current_ratio >= 2) score += 10;
      else if (snapshot.current_ratio >= 1.5) score += 5;
      else if (snapshot.current_ratio < 1) score -= 10;
      else if (snapshot.current_ratio < 1.2) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Growth score based on revenue and EPS CAGR
   */
  getGrowthScore(snapshot: StockSnapshot): number {
    let score = 50;
    let hasData = false;

    // Revenue CAGR scoring
    if (snapshot.revenue_cagr_5y != null) {
      hasData = true;
      const cagr = snapshot.revenue_cagr_5y * 100;
      if (cagr > 20) score += 20;
      else if (cagr > 15) score += 15;
      else if (cagr > 10) score += 10;
      else if (cagr > 5) score += 5;
      else if (cagr < 0) score -= 15;
      else if (cagr < 5) score -= 5;
    }

    // EPS CAGR scoring
    if (snapshot.eps_cagr_5y != null) {
      hasData = true;
      const cagr = snapshot.eps_cagr_5y * 100;
      if (cagr > 20) score += 20;
      else if (cagr > 15) score += 15;
      else if (cagr > 10) score += 10;
      else if (cagr > 5) score += 5;
      else if (cagr < 0) score -= 15;
    }

    // If no growth data, return neutral
    if (!hasData) return 50;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Momentum score based on technical indicators
   */
  getMomentumScore(technicals: TechnicalIndicators): number {
    let score = 50;

    // RSI scoring
    if (technicals.rsi_14 != null) {
      if (technicals.rsi_14 >= 40 && technicals.rsi_14 <= 60) score += 10;
      else if (technicals.rsi_14 >= 30 && technicals.rsi_14 <= 70) score += 5;
      else if (technicals.rsi_14 < 30) score += 5; // Oversold can be opportunity
      else if (technicals.rsi_14 > 70) score -= 5; // Overbought risk
    }

    // MACD scoring
    if (technicals.macd_histogram != null) {
      if (technicals.macd_histogram > 0) score += 10;
      else score -= 5;
    }

    // Price vs SMAs
    if (technicals.price_change_20d != null) {
      if (technicals.price_change_20d > 5) score += 5;
      else if (technicals.price_change_20d < -5) score -= 5;
    }

    // Volume ratio
    if (technicals.volume_ratio != null) {
      if (technicals.volume_ratio > 1.5) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate trading signals based on data
   */
  generateSignals(
    snapshot: StockSnapshot,
    technicals?: TechnicalIndicators
  ): Signal[] {
    const signals: Signal[] = [];

    // RSI signals
    if (technicals?.rsi_14 != null) {
      if (technicals.rsi_14 < 30) {
        signals.push({
          type: 'bullish',
          indicator: 'RSI',
          message: `RSI at ${technicals.rsi_14.toFixed(1)} - Oversold`,
          strength: technicals.rsi_14 < 20 ? 3 : 2,
        });
      } else if (technicals.rsi_14 > 70) {
        signals.push({
          type: 'bearish',
          indicator: 'RSI',
          message: `RSI at ${technicals.rsi_14.toFixed(1)} - Overbought`,
          strength: technicals.rsi_14 > 80 ? 3 : 2,
        });
      }
    }

    // MACD signals
    if (technicals?.macd_histogram != null) {
      if (technicals.macd_histogram > 0) {
        signals.push({
          type: 'bullish',
          indicator: 'MACD',
          message: 'MACD above signal line - Bullish momentum',
          strength: 2,
        });
      } else {
        signals.push({
          type: 'bearish',
          indicator: 'MACD',
          message: 'MACD below signal line - Bearish momentum',
          strength: 2,
        });
      }
    }

    // Valuation signals
    if (snapshot.pe != null && snapshot.pe > 0 && snapshot.pe < 15) {
      signals.push({
        type: 'bullish',
        indicator: 'Valuation',
        message: `Low P/E ratio (${snapshot.pe.toFixed(1)}) - Potentially undervalued`,
        strength: snapshot.pe < 10 ? 3 : 2,
      });
    }

    // Quality signals
    if (snapshot.roe != null && snapshot.roe > 0.20) {
      signals.push({
        type: 'bullish',
        indicator: 'Quality',
        message: `High ROE (${(snapshot.roe * 100).toFixed(1)}%) - Strong returns`,
        strength: snapshot.roe > 0.30 ? 3 : 2,
      });
    }

    // Debt signals
    if (snapshot.debt_to_equity != null) {
      if (snapshot.debt_to_equity < 0.3) {
        signals.push({
          type: 'bullish',
          indicator: 'Balance Sheet',
          message: `Low debt (D/E: ${snapshot.debt_to_equity.toFixed(2)}) - Strong balance sheet`,
          strength: 2,
        });
      } else if (snapshot.debt_to_equity > 2) {
        signals.push({
          type: 'bearish',
          indicator: 'Balance Sheet',
          message: `High debt (D/E: ${snapshot.debt_to_equity.toFixed(2)}) - Leverage risk`,
          strength: snapshot.debt_to_equity > 3 ? 3 : 2,
        });
      }
    }

    // Growth signals
    if (snapshot.revenue_cagr_5y != null && snapshot.revenue_cagr_5y > 0.15) {
      signals.push({
        type: 'bullish',
        indicator: 'Growth',
        message: `Strong revenue growth (${(snapshot.revenue_cagr_5y * 100).toFixed(1)}% CAGR)`,
        strength: snapshot.revenue_cagr_5y > 0.25 ? 3 : 2,
      });
    }

    // Momentum signals from price changes
    if (technicals?.price_change_20d != null) {
      if (technicals.price_change_20d > 10) {
        signals.push({
          type: 'bullish',
          indicator: 'Momentum',
          message: `Strong 20-day momentum (+${technicals.price_change_20d.toFixed(1)}%)`,
          strength: 2,
        });
      } else if (technicals.price_change_20d < -10) {
        signals.push({
          type: 'bearish',
          indicator: 'Momentum',
          message: `Weak 20-day momentum (${technicals.price_change_20d.toFixed(1)}%)`,
          strength: 2,
        });
      }
    }

    return signals;
  }

  /**
   * Get a summary recommendation
   */
  getRecommendation(scores: ScoreBreakdown, signals: Signal[]): {
    rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
    confidence: number;
    summary: string;
  } {
    const bullishSignals = signals.filter(s => s.type === 'bullish').length;
    const bearishSignals = signals.filter(s => s.type === 'bearish').length;
    const signalScore = bullishSignals - bearishSignals;

    let rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
    let summary: string;

    if (scores.overall >= 70 && signalScore >= 2) {
      rating = 'Strong Buy';
      summary = 'Excellent fundamentals with bullish technical signals';
    } else if (scores.overall >= 60 && signalScore >= 0) {
      rating = 'Buy';
      summary = 'Good fundamentals, favorable technical setup';
    } else if (scores.overall >= 40 && scores.overall < 60) {
      rating = 'Hold';
      summary = 'Mixed signals, monitor for changes';
    } else if (scores.overall < 40 && signalScore <= 0) {
      rating = 'Sell';
      summary = 'Weak fundamentals with bearish signals';
    } else if (scores.overall < 30 && signalScore < -1) {
      rating = 'Strong Sell';
      summary = 'Poor fundamentals and bearish momentum';
    } else {
      rating = 'Hold';
      summary = 'Neutral outlook';
    }

    // Confidence based on data quality and signal agreement
    const dataPoints = [
      scores.valuation !== 50,
      scores.quality !== 50,
      scores.growth !== 50,
      scores.momentum !== 50,
    ].filter(Boolean).length;

    const confidence = Math.min(100, (dataPoints / 4) * 50 + Math.abs(signalScore) * 10 + 30);

    return { rating, confidence: Math.round(confidence), summary };
  }
}
