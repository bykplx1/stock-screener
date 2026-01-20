// backend/src/scripts/test-db.ts
import { SupabaseService } from '../utils/supabase-client';

async function testDatabase() {
  console.log('🧪 Testing database connection...\n');

  const supabase = new SupabaseService();

  try {
    // Test 1: Get stocks count
    console.log('Test 1: Fetching stocks from database...');
    const stocks = await supabase.getActiveStocks();
    console.log(`  ✅ Found ${stocks.length} active stocks in database`);

    if (stocks.length === 0) {
      console.log('\n⚠️  WARNING: No stocks in database!');
      console.log('   You need to populate the stocks table first.');
      console.log('   Run this SQL in Supabase:');
      console.log(`
        INSERT INTO stocks (symbol, company_name, sector, industry, exchange, is_active)
        VALUES 
          ('AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 'NASDAQ', true),
          ('MSFT', 'Microsoft Corporation', 'Technology', 'Software', 'NASDAQ', true),
          ('JPM', 'JPMorgan Chase & Co.', 'Financials', 'Banks', 'NYSE', true);
      `);
      return;
    }

    // Test 2: Show sample stocks
    console.log('\nTest 2: Sample stocks:');
    stocks.slice(0, 5).forEach(stock => {
      console.log(`  - ${stock.symbol}: ${stock.company_name} (${stock.sector})`);
    });

    // Test 3: Test specific stock lookup
    console.log('\nTest 3: Looking up specific stock...');
    const apple = await supabase.getStockBySymbol('AAPL');
    if (apple) {
      console.log(`  ✅ Found: ${apple.symbol} - ${apple.company_name}`);
    } else {
      console.log('  ⚠️  AAPL not found in database');
    }

    console.log('\n✅ Database connection successful!');

  } catch (error) {
    console.error('\n❌ Database test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testDatabase();