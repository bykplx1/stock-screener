// backend/src/scripts/fetch-all-stocks.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { SupabaseService } from '../utils/supabase-client.js';
import { saveToDatabase } from '../utils/data-transformer.js';

const yahoo = new YahooFinanceClient();
const supabase = new SupabaseService();

async function fetchAllStocks(): Promise<void> {
  console.log('🚀 Starting stock data fetch...');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Create job log
  const job = await supabase.createETLJob('fetch_financials');

  try {
    // Get all active stocks
    const stocks = await supabase.getActiveStocks();
    console.log(`📊 Found ${stocks.length} stocks to update\n`);

    let successful = 0;
    let failed = 0;

    // Fetch each stock
    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      
      console.log(`[${i + 1}/${stocks.length}] Processing ${stock.symbol}...`);

      try {
        // Fetch from Yahoo Finance
        const data = await yahoo.fetchStockData(stock.symbol);

        if (data && data.data_quality_score >= 40) {
          // Save to database
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

        // Log API call
        await supabase.logAPIUsage({
          provider: 'Yahoo Finance',
          symbol: stock.symbol,
          request_time: new Date(),
          response_status: 200
        });

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Error: ${errorMessage}`);
        
        // Log failed API call
        await supabase.logAPIUsage({
          provider: 'Yahoo Finance',
          symbol: stock.symbol,
          request_time: new Date(),
          response_status: 500,
          error_message: errorMessage
        });
      }

      // Rate limiting: 1 request per second
      if (i < stocks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update job log
    await supabase.updateETLJob(job.id!, {
      status: 'completed',
      completed_at: new Date(),
      records_processed: successful
    });

    console.log('\n✅ Fetch complete!');
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total time: ${((stocks.length * 1000) / 60000).toFixed(1)} minutes`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Fatal error:', errorMessage);
    
    // Update job as failed
    await supabase.updateETLJob(job.id!, {
      status: 'failed',
      completed_at: new Date(),
      error_message: errorMessage
    });
    
    process.exit(1);
  }
}

fetchAllStocks().catch(console.error);