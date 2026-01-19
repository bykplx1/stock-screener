// backend/src/types/index.ts

export interface StockSnapshot {
  symbol: string;
  snapshot_date: string;
  
  // Quality metrics
  roe: number | null;
  roic: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  
  // Health metrics
  debt_to_equity: number | null;
  current_ratio: number | null;
  free_cash_flow: number | null;
  
  // Growth metrics
  revenue_cagr_5y: number | null;
  eps_cagr_5y: number | null;
  
  // Valuation metrics
  pe: number | null;
  peg: number | null;
  fcf_yield: number | null;
  
  // Price data
  price: number | null;
  market_cap: number | null;
  
  // Metadata
  data_quality_score: number;
}

export interface DatabaseSnapshot extends Omit<StockSnapshot, 'symbol'> {
  stock_id: number;
}

export interface Stock {
  id: number;
  symbol: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  is_active: boolean;
  priority_tier: number;
  last_updated: string | null;
}

export interface ETLJob {
  id?: number;
  job_type: string;
  status: 'running' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  records_processed?: number;
  error_message?: string;
}

export interface APIUsageLog {
  provider: string;
  symbol: string;
  request_time: Date;
  response_status: number;
  error_message?: string;
}

export interface FetchResult {
  success: boolean;
  symbol: string;
  data?: StockSnapshot;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}