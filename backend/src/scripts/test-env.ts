// backend/src/scripts/test-env.ts
import { env } from '../config/env';

console.log('🧪 Testing environment configuration...\n');

console.log('Environment variables:');
console.log(`  SUPABASE_URL: ${env.SUPABASE_URL.substring(0, 30)}...`);
console.log(`  SUPABASE_KEY: ${env.SUPABASE_KEY.substring(0, 30)}...`);

console.log('\n✅ Environment configuration loaded successfully!');