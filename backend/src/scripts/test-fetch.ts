// backend/src/scripts/test-fetch.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { SupabaseService } from '../utils/supabase-client.js';
import { saveToDatabase } from '../utils/data-transformer.js';

const yahoo = new YahooFinanceClient();
const supabase = new SupabaseService();

async function testFetch(): Promise<void> {
  const testSymbols = ['AAPL', 'MSFT', 'JPM'];
  
  console.log('🧪 Testing Yahoo Finance fetch...\n');

  for (const symbol of testSymbols) {
    console.log(`\nFetching ${symbol}...`);
    
    const data = await yahoo.fetchStockData(symbol);
    
    if (data) {
      console.log('✅ Data fetched successfully!');
      console.log(`   Price: $${data.price?.toFixed(2) ?? 'N/A'}`);
      console.log(`   Market Cap: $${data.market_cap ? (data.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      console.log(`   ROE: ${data.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   PE: ${data.pe?.toFixed(2) ?? 'N/A'}`);
      console.log(`   Debt/Equity: ${data.debt_to_equity?.toFixed(2) ?? 'N/A'}`);
      console.log(`   Revenue CAGR (5Y): ${data.revenue_cagr_5y ? (data.revenue_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   Data Quality: ${data.data_quality_score}/100`);
      
      // Save to database
      const result = await saveToDatabase(supabase, data);
      if (result.success) {
        console.log('✅ Saved to database!');
      } else {
        console.log(`❌ Database error: ${result.error}`);
      }
    } else {
      console.log('❌ Failed to fetch data');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Test complete!');
}

testFetch().catch(console.error);