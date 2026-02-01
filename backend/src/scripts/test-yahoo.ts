// test-yahoo.ts
import { YahooFinanceClient } from '../utils/yahoo-client.js';

async function testYahoo() {
  console.log('🧪 Testing Yahoo Finance API...\n');

  const yahoo = new YahooFinanceClient();

  try {
    // Test 1: Basic metrics (faster)
    console.log('Test 1: Fetching basic metrics for AAPL...');
    const basicData = await yahoo.fetchBasicMetrics('AAPL');

    if (!basicData) {
      console.error('❌ Failed to fetch basic data');
      process.exit(1);
    }

    console.log('✅ Basic metrics fetched!\n');
    printStockData('Basic Metrics', basicData);

    // Test 2: Complete metrics (includes historical data)
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Fetching complete metrics for AAPL (with historical data)...');
    const completeData = await yahoo.fetchCompleteMetrics('AAPL');

    if (!completeData) {
      console.error('❌ Failed to fetch complete data');
      process.exit(1);
    }

    console.log('✅ Complete metrics fetched!\n');
    printStockData('Complete Metrics', completeData);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests complete!');

  } catch (error) {
    console.error('\n❌ Yahoo Finance test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printStockData(label: string, data: any) {
  console.log(`${label}:`);
  console.log('─'.repeat(50));
  console.log(`Symbol:              ${data.symbol}`);
  console.log(`Price:               $${data.price?.toFixed(2) ?? 'N/A'}`);
  console.log(`Market Cap:          $${data.market_cap ? (data.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}`);
  console.log(`PE Ratio:            ${data.pe?.toFixed(2) ?? 'N/A'}`);
  console.log(`PEG Ratio:           ${data.peg?.toFixed(2) ?? 'N/A'}`);
  console.log(`ROE:                 ${data.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`ROIC (ROA):          ${data.roic ? (data.roic * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`Gross Margin:        ${data.gross_margin ? (data.gross_margin * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`Operating Margin:    ${data.operating_margin ? (data.operating_margin * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`Debt/Equity:         ${data.debt_to_equity?.toFixed(2) ?? 'N/A'}`);
  console.log(`Current Ratio:       ${data.current_ratio?.toFixed(2) ?? 'N/A'}`);
  console.log(`Free Cash Flow:      ${data.free_cash_flow ? '$' + (data.free_cash_flow / 1e9).toFixed(2) + 'B' : 'N/A'}`);
  console.log(`Revenue CAGR (5Y):   ${data.revenue_cagr_5y ? (data.revenue_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`EPS CAGR (5Y):       ${data.eps_cagr_5y ? (data.eps_cagr_5y * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`FCF Yield:           ${data.fcf_yield ? (data.fcf_yield * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log(`Data Quality Score:  ${data.data_quality_score}/100`);
  console.log('─'.repeat(50));
}

testYahoo();
