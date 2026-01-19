// backend/src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

function validateEnv(): EnvConfig {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_KEY: process.env.SUPABASE_KEY!,
  };
}

export const env = validateEnv();