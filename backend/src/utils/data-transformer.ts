// backend/src/utils/data-transformer.ts
import type { StockSnapshot, DatabaseSnapshot, SaveResult } from '../types/index.js';
import { SupabaseService } from './supabase-client.js';

export async function saveToDatabase(
  supabase: SupabaseService,
  stockData: StockSnapshot
): Promise<SaveResult> {
  try {
    // Get stock from database
    const stock = await supabase.getStockBySymbol(stockData.symbol);

    if (!stock) {
      return { 
        success: false, 
        error: `Stock ${stockData.symbol} not found in database` 
      };
    }

    // Prepare database snapshot (remove symbol, add stock_id)
    const { symbol, ...snapshotWithoutSymbol } = stockData;
    const snapshot: DatabaseSnapshot = {
      ...snapshotWithoutSymbol,
      stock_id: stock.id
    };

    // Upsert financial snapshot
    const result = await supabase.upsertFinancialSnapshot(snapshot);

    if (!result.success) {
      return result;
    }

    // Update last_updated timestamp
    await supabase.updateStockLastUpdated(stock.id);

    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error saving ${stockData.symbol}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}