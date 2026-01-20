// backend/src/scripts/test-yahoo.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';

async function testYahoo() {
  console.log('🧪 Testing Yahoo Finance API...\n');

  const yahoo = new YahooFinanceClient();

  try {
    console.log('Fetching AAPL data...');
    const data = await yahoo.fetchBasicMetrics('AAPL');

    if (!data) {
      console.error('❌ Failed to fetch data from Yahoo Finance');
      process.exit(1);
    }

    console.log('\n✅ Yahoo Finance API works!\n');
    console.log('Sample data received:');
    console.log('─'.repeat(50));
    console.log(`Symbol:              ${data.symbol}`);
    console.log(`Price:               $${data.price?.toFixed(2) ?? 'N/A'}`);
    console.log(`Market Cap:          $${data.market_cap ? (data.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}`);
    console.log(`PE Ratio:            ${data.pe?.toFixed(2) ?? 'N/A'}`);
    console.log(`ROE:                 ${data.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`Gross Margin:        ${data.gross_margin ? (data.gross_margin * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`Operating Margin:    ${data.operating_margin ? (data.operating_margin * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`Debt/Equity:         ${data.debt_to_equity?.toFixed(2) ?? 'N/A'}`);
    console.log(`Current Ratio:       ${data.current_ratio?.toFixed(2) ?? 'N/A'}`);
    console.log(`Revenue CAGR (5Y):   ${data.revenue_cagr_5y ? (data.revenue_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`EPS CAGR (5Y):       ${data.eps_cagr_5y ? (data.eps_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`Data Quality Score:  ${data.data_quality_score}/100`);
    console.log('─'.repeat(50));

    if (data.data_quality_score < 40) {
      console.log('\n⚠️  WARNING: Low data quality score!');
      console.log('   This stock might have incomplete financial data.');
    }

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('\n❌ Yahoo Finance test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testYahoo();