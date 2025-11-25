#/bin/bash
set -e

echo "🆓 Zero-Budget WeflutGrid Deployment"

# 1. Setup Supabase
echo "📦 Step 1: Setup Database"
echo "   Go to supabase.com → Create project → Copy connection string"
read -p "   Paste your Supabase URL: " DB_URL

# 2. Initialize database
echo "📊 Initializing database schema..."
psql "$DB_URL" < src/db/schema_minimal.sql

# 3. Setup GitHub Actions
echo "🔧 Step 2: Setup GitHub Actions ETL"
echo "   Go to your GitHub repo → Settings → Secrets"
echo "   Add secret: SUPABASE_DB_URL = $DB_URL"
read -p "   Press enter when done..."

# 4. Setup Vercel
echo "🌐 Step 3: Deploy Tile API to Vercel"
cd vercel-tiles
vercel --prod
echo "   Your tile URL: $(vercel inspect --prod | grep 'URL')"

# 5. Run initial ETL manually
echo "🚀 Step 4: Running initial ETL..."
cd ..
node scripts/etl_github_action.js

echo "✅ Deployment complete!"
echo ""
echo "📱 Next steps:"
echo "   1. Update TILE_API in App.tsx with your Vercel URL"
echo "   2. Run: npx expo start"
echo "   3. Scan QR code on your phone"
```

---

## **Monthly Cost Breakdown**

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| Supabase | 500MB DB, 2GB transfer | All data fits | **$0** |
| Vercel | 100GB bandwidth | Tiles + CDN | **$0** |
| GitHub Actions | 2000 min/month | Weekly ETL (~40 min) | **$0** |
| Expo | Unlimited | Mobile app | **$0** |
| **TOTAL** | | | **$0/month** |

---

## **Scale Strategy (When You Get Funding)**
```
Free Tier (Now)          → Paid Tier (Later)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase 500MB          → Railway $20/mo (4GB DB)
Vercel 100GB            → Vercel Pro $20/mo (1TB)
GitHub Actions          → Dedicated EC2 $10/mo
React Native Maps       → Mapbox $0 (free tier works)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$0/month                → $50/month (10x capacity)