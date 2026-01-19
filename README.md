# 1. Setup
cd backend
npm install

# 2. Create .env
echo "SUPABASE_URL=your_url" > .env
echo "SUPABASE_KEY=your_key" >> .env

# 3. Test
npm run test

# 4. Run full fetch
npm run fetch

# 5. Calculate scores
npm run scores

# 6. Set up GitHub Actions
# (copy YAML to .github/workflows/)

# 7. Done! ✅