// test-full-pipeline.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { SupabaseService } from '../utils/supabase-client.js';
import { saveToDatabase } from '../utils/data-transformer.js';

async function testFullPipeline() {
  console.log('🧪 Testing full pipeline (fetch → transform → save)...\n');

  const yahoo = new YahooFinanceClient();
  const supabase = new SupabaseService();
  const testSymbol = 'AAPL';

  try {
    // Step 1: Fetch from Yahoo
    console.log(`Step 1: Fetching ${testSymbol} from Yahoo Finance...`);
    const data = await yahoo.fetchBasicMetrics(testSymbol);

    if (!data) {
      throw new Error('Failed to fetch data');
    }
    console.log(`  ✅ Data fetched (Quality: ${data.data_quality_score}/100)`);

    // Step 2: Save to database
    console.log('\nStep 2: Saving to Supabase...');
    const result = await saveToDatabase(supabase, data);

    if (!result.success) {
      throw new Error(`Failed to save: ${result.error}`);
    }
    console.log('  ✅ Data saved to database');

    // Step 3: Verify data was saved
    console.log('\nStep 3: Verifying data in database...');

    // You'll need to add this method to SupabaseService
    const verification = await verifySnapshot(supabase, testSymbol);

    if (verification) {
      console.log('  ✅ Data verified in database');
      console.log(`     Stock ID: ${verification.stock_id}`);
      console.log(`     Snapshot Date: ${verification.snapshot_date}`);
      console.log(`     ROE: ${verification.roe ? (verification.roe * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`     PE: ${verification.pe?.toFixed(2) ?? 'N/A'}`);
    }

    console.log('\n✅ Full pipeline test PASSED!');
    console.log('\n🎉 Everything is working correctly!');

  } catch (error) {
    console.error('\n❌ Pipeline test FAILED:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function verifySnapshot(supabase: SupabaseService, symbol: string) {
  // Get stock
  const stock = await supabase.getStockBySymbol(symbol);
  if (!stock) return null;

  // Query financial_snapshots
  const client = (supabase as any).client;
  const { data, error } = await client
    .from('financial_snapshots')
    .select('*')
    .eq('stock_id', stock.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error verifying:', error);
    return null;
  }

  return data;
}

testFullPipeline();
