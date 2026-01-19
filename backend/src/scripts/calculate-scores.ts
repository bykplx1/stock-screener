// backend/src/scripts/calculate-scores.ts
import { SupabaseService } from '../utils/supabase-client.js';

const supabase = new SupabaseService();

async function calculateScores(): Promise<void> {
  console.log('🧮 Starting score calculation...');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Calculate sector benchmarks
    console.log('📊 Calculating sector benchmarks...');
    await supabase.callFunction('calculate_sector_benchmarks', { 
      target_date: today 
    });
    console.log('   ✅ Sector benchmarks calculated');

    // 2. Calculate VI scores
    console.log('📈 Calculating VI scores...');
    await supabase.callFunction('calculate_vi_scores_with_sector', { 
      target_date: today 
    });
    console.log('   ✅ VI scores calculated');

    // 3. Calculate sector rankings
    console.log('🏆 Calculating sector rankings...');
    await supabase.callFunction('calculate_sector_rankings', { 
      target_date: today 
    });
    console.log('   ✅ Sector rankings calculated');

    console.log('\n✅ All scores calculated successfully!');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Error calculating scores:', errorMessage);
    process.exit(1);
  }
}

calculateScores().catch(console.error);