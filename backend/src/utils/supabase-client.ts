// supabase-client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type { Stock, ETLJob, APIUsageLog, DatabaseSnapshot, SaveResult } from '../types/index.js';

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  }

  async getActiveStocks(): Promise<Stock[]> {
    const { data, error } = await this.client
      .from('stocks')
      .select('*')
      .eq('is_active', true)
      .order('priority_tier', { ascending: true });

    if (error) throw new Error(`Failed to fetch stocks: ${error.message}`);
    return data || [];
  }

  async getStockBySymbol(symbol: string): Promise<Stock | null> {
    const { data, error } = await this.client
      .from('stocks')
      .select('*')
      .eq('symbol', symbol)
      .single();

    if (error) {
      console.error(`Stock ${symbol} not found:`, error.message);
      return null;
    }
    return data;
  }

  async upsertFinancialSnapshot(snapshot: DatabaseSnapshot): Promise<SaveResult> {
    const { error } = await this.client
      .from('financial_snapshots')
      .upsert(snapshot, {
        onConflict: 'stock_id,snapshot_date'
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async updateStockLastUpdated(stockId: number): Promise<void> {
    const { error } = await this.client
      .from('stocks')
      .update({ last_updated: new Date().toISOString() })
      .eq('id', stockId);

    if (error) {
      console.error(`Failed to update last_updated for stock ${stockId}:`, error.message);
    }
  }

  async createETLJob(jobType: string): Promise<ETLJob> {
    const { data, error } = await this.client
      .from('etl_jobs')
      .insert({
        job_type: jobType,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create ETL job: ${error.message}`);
    return data;
  }

  async updateETLJob(
    jobId: number,
    updates: Partial<Omit<ETLJob, 'id'>>
  ): Promise<void> {
    const updateData: any = {
      ...updates,
      completed_at: updates.completed_at?.toISOString(),
    };

    const { error } = await this.client
      .from('etl_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update ETL job ${jobId}:`, error.message);
    }
  }

  async logAPIUsage(log: APIUsageLog): Promise<void> {
    const { error } = await this.client
      .from('api_usage_log')
      .insert({
        ...log,
        request_time: log.request_time.toISOString()
      });

    if (error) {
      console.error('Failed to log API usage:', error.message);
    }
  }

  async callFunction(functionName: string, params: any): Promise<any> {
    const { data, error } = await this.client.rpc(functionName, params);
    if (error) throw new Error(`Function ${functionName} failed: ${error.message}`);
    return data;
  }
}
