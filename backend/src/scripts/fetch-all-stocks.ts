// fetch-all-stocks.ts - Enhanced fetch script with caching and progress

import { YahooFinanceClient } from '../utils/yahoo-client.js';
import { SupabaseService } from '../utils/supabase-client.js';
import { saveToDatabase } from '../utils/data-transformer.js';
import { CacheManager } from '../utils/cache.js';
import { StockScorer } from '../utils/scoring.js';
import { logger, setLogLevel, LogLevel } from '../utils/logger.js';

// Configuration
const MIN_QUALITY_SCORE = 40;
const CONCURRENCY = 3; // Conservative for rate limiting

const cache = new CacheManager();
const yahoo = new YahooFinanceClient(cache);
const supabase = new SupabaseService();
const scorer = new StockScorer();

interface FetchStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  cached: number;
  startTime: Date;
}

async function fetchAllStocks(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          STOCK DATA FETCH - Enhanced Pipeline            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Started: ${new Date().toISOString()}`);
  console.log();

  // Create job log
  const job = await supabase.createETLJob('fetch_financials_enhanced');

  const stats: FetchStats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    cached: 0,
    startTime: new Date(),
  };

  try {
    // Get all active stocks
    const stocks = await supabase.getActiveStocks();
    stats.total = stocks.length;
    console.log(`Found ${stocks.length} active stocks to update`);
    console.log();

    // Progress bar setup
    const progressBarWidth = 40;

    // Process stocks with progress callback
    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      const progress = ((i + 1) / stocks.length) * 100;
      const filled = Math.round((progress / 100) * progressBarWidth);
      const progressBar = '█'.repeat(filled) + '░'.repeat(progressBarWidth - filled);

      // Clear line and show progress
      process.stdout.write(`\r[${progressBar}] ${progress.toFixed(1)}% | ${stock.symbol.padEnd(6)}`);

      try {
        // Fetch enhanced data (with technicals)
        const result = await yahoo.fetchEnhanced(stock.symbol, {
          useCache: true,
          includeHistory: true
        });

        if (result.success && result.data) {
          // Check data quality
          if (result.data.data_quality_score < MIN_QUALITY_SCORE) {
            stats.skipped++;
            continue;
          }

          // Calculate and log scores (for monitoring)
          const scores = scorer.calculateScores(result.data, result.technicals);

          // Save to database
          const saveResult = await saveToDatabase(supabase, result.data);

          if (saveResult.success) {
            stats.successful++;
          } else {
            stats.failed++;
            logger.error(`DB error for ${stock.symbol}: ${saveResult.error}`);
          }

          // Log API usage
          await supabase.logAPIUsage({
            provider: 'Yahoo Finance',
            symbol: stock.symbol,
            request_time: new Date(),
            response_status: 200
          });
        } else {
          stats.failed++;

          await supabase.logAPIUsage({
            provider: 'Yahoo Finance',
            symbol: stock.symbol,
            request_time: new Date(),
            response_status: 500,
            error_message: result.error
          });
        }
      } catch (error) {
        stats.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing ${stock.symbol}: ${errorMessage}`);

        await supabase.logAPIUsage({
          provider: 'Yahoo Finance',
          symbol: stock.symbol,
          request_time: new Date(),
          response_status: 500,
          error_message: errorMessage
        });
      }

      // Small delay to avoid overwhelming the API
      await sleep(200);
    }

    // Clear progress line
    console.log('\n');

    // Update job log
    await supabase.updateETLJob(job.id!, {
      status: 'completed',
      completed_at: new Date(),
      records_processed: stats.successful
    });

    // Final summary
    const duration = (Date.now() - stats.startTime.getTime()) / 1000;
    const cacheStats = cache.getStats();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    FETCH COMPLETE                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log();
    console.log('RESULTS:');
    console.log(`  Total Stocks:     ${stats.total}`);
    console.log(`  Successful:       ${stats.successful} ✓`);
    console.log(`  Failed:           ${stats.failed} ✗`);
    console.log(`  Skipped (low Q):  ${stats.skipped}`);
    console.log();
    console.log('PERFORMANCE:');
    console.log(`  Duration:         ${formatDuration(duration)}`);
    console.log(`  Avg per stock:    ${(duration / stats.total).toFixed(2)}s`);
    console.log(`  Success rate:     ${((stats.successful / stats.total) * 100).toFixed(1)}%`);
    console.log();
    console.log('CACHE:');
    console.log(`  Entries:          ${cacheStats.entries}`);
    console.log(`  Size:             ${(cacheStats.sizeBytes / 1024).toFixed(1)}KB`);
    console.log();

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs.toFixed(0)}s`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
setLogLevel(LogLevel.WARN);
fetchAllStocks().catch(console.error);
