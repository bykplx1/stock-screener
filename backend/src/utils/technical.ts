// technical.ts - Technical indicators calculator

export interface TechnicalIndicators {
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_20: number | null;
  ema_50: number | null;
  bollinger_upper: number | null;
  bollinger_middle: number | null;
  bollinger_lower: number | null;
  atr_14: number | null;
  price_change_1d: number | null;
  price_change_5d: number | null;
  price_change_20d: number | null;
  volume_ratio: number | null;
}

export interface PriceBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalAnalyzer {
  private prices: number[];
  private highs: number[];
  private lows: number[];
  private volumes: number[];

  constructor(bars: PriceBar[]) {
    this.prices = bars.map(b => b.close);
    this.highs = bars.map(b => b.high);
    this.lows = bars.map(b => b.low);
    this.volumes = bars.map(b => b.volume);
  }

  calculateAll(): TechnicalIndicators {
    return {
      rsi_14: this.calculateRSI(14),
      ...this.calculateMACD(),
      sma_20: this.calculateSMA(20),
      sma_50: this.calculateSMA(50),
      sma_200: this.calculateSMA(200),
      ema_20: this.calculateEMA(20),
      ema_50: this.calculateEMA(50),
      ...this.calculateBollingerBands(20, 2),
      atr_14: this.calculateATR(14),
      price_change_1d: this.getPriceChange(1),
      price_change_5d: this.getPriceChange(5),
      price_change_20d: this.getPriceChange(20),
      volume_ratio: this.getVolumeRatio(20),
    };
  }

  /**
   * Calculate Relative Strength Index (RSI)
   */
  calculateRSI(period: number = 14): number | null {
    if (this.prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const change = this.prices[this.prices.length - period - 1 + i] -
                     this.prices[this.prices.length - period - 1 + i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(fast: number = 12, slow: number = 26, signal: number = 9): {
    macd: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
  } {
    if (this.prices.length < slow + signal) {
      return { macd: null, macd_signal: null, macd_histogram: null };
    }

    const emaFast = this.calculateEMAArray(fast);
    const emaSlow = this.calculateEMAArray(slow);

    if (!emaFast || !emaSlow) {
      return { macd: null, macd_signal: null, macd_histogram: null };
    }

    // Calculate MACD line
    const macdLine: number[] = [];
    const startIdx = slow - 1;
    for (let i = startIdx; i < this.prices.length; i++) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }

    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMAFromArray(macdLine, signal);

    if (!signalLine || signalLine.length === 0) {
      return { macd: macdLine[macdLine.length - 1] || null, macd_signal: null, macd_histogram: null };
    }

    const macd = macdLine[macdLine.length - 1];
    const macdSignal = signalLine[signalLine.length - 1];
    const histogram = macd - macdSignal;

    return { macd, macd_signal: macdSignal, macd_histogram: histogram };
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(period: number): number | null {
    if (this.prices.length < period) return null;

    const slice = this.prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(period: number): number | null {
    const emaArray = this.calculateEMAArray(period);
    return emaArray ? emaArray[emaArray.length - 1] : null;
  }

  private calculateEMAArray(period: number): number[] | null {
    if (this.prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    const ema: number[] = [];

    // Start with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += this.prices[i];
    }
    ema[period - 1] = sum / period;

    // Calculate EMA for remaining prices
    for (let i = period; i < this.prices.length; i++) {
      ema[i] = (this.prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  private calculateEMAFromArray(data: number[], period: number): number[] | null {
    if (data.length < period) return null;

    const multiplier = 2 / (period + 1);
    const ema: number[] = [];

    // Start with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema[period - 1] = sum / period;

    // Calculate EMA for remaining
    for (let i = period; i < data.length; i++) {
      ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(period: number = 20, stdDev: number = 2): {
    bollinger_upper: number | null;
    bollinger_middle: number | null;
    bollinger_lower: number | null;
  } {
    if (this.prices.length < period) {
      return { bollinger_upper: null, bollinger_middle: null, bollinger_lower: null };
    }

    const slice = this.prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;

    // Calculate standard deviation
    const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(variance);

    return {
      bollinger_upper: sma + stdDev * std,
      bollinger_middle: sma,
      bollinger_lower: sma - stdDev * std,
    };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  calculateATR(period: number = 14): number | null {
    if (this.prices.length < period + 1) return null;

    const trueRanges: number[] = [];

    for (let i = 1; i < this.prices.length; i++) {
      const high = this.highs[i];
      const low = this.lows[i];
      const prevClose = this.prices[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Calculate average of last 'period' true ranges
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Get price change percentage over N days
   */
  getPriceChange(days: number): number | null {
    if (this.prices.length <= days) return null;

    const current = this.prices[this.prices.length - 1];
    const previous = this.prices[this.prices.length - 1 - days];

    return ((current - previous) / previous) * 100;
  }

  /**
   * Get volume ratio (current volume / average volume)
   */
  getVolumeRatio(avgPeriod: number = 20): number | null {
    if (this.volumes.length < avgPeriod) return null;

    const currentVolume = this.volumes[this.volumes.length - 1];
    const avgVolume = this.volumes.slice(-avgPeriod).reduce((a, b) => a + b, 0) / avgPeriod;

    if (avgVolume === 0) return null;
    return currentVolume / avgVolume;
  }

  /**
   * Get 52-week high/low position
   */
  get52WeekPosition(): { pctFromHigh: number; pctFromLow: number } | null {
    if (this.prices.length < 252) return null;

    const yearPrices = this.prices.slice(-252);
    const high = Math.max(...yearPrices);
    const low = Math.min(...yearPrices);
    const current = this.prices[this.prices.length - 1];

    return {
      pctFromHigh: ((high - current) / high) * 100,
      pctFromLow: ((current - low) / low) * 100,
    };
  }
}
