// test-batch-fetch.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { SupabaseService } from '../utils/supabase-client.js';
import { saveToDatabase } from '../utils/data-transformer.js';

const yahoo = new YahooFinanceClient();
const supabase = new SupabaseService();

async function testBatchFetch() {
  console.log('🧪 Testing batch fetch (5 stocks)...\n');

  const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < testSymbols.length; i++) {
    const symbol = testSymbols[i];

    console.log(`[${i + 1}/${testSymbols.length}] Processing ${symbol}...`);

    try {
      const data = await yahoo.fetchBasicMetrics(symbol);

      if (data && data.data_quality_score >= 40) {
        const result = await saveToDatabase(supabase, data);

        if (result.success) {
          successful++;
          console.log(`   ✅ Saved (Quality: ${data.data_quality_score}/100)`);
        } else {
          failed++;
          console.log(`   ❌ Database error: ${result.error}`);
        }
      } else {
        failed++;
        console.log(`   ⚠️  Low quality data, skipped`);
      }

    } catch (error) {
      failed++;
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Rate limiting
    if (i < testSymbols.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n✅ Batch fetch complete!');
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total time: ~${testSymbols.length} seconds`);
}

testBatchFetch();
