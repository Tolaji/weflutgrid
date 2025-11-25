# WeflutGrid Deployment Guide

Complete step-by-step deployment for zero-budget infrastructure.

## Prerequisites

- Node.js 18+
- Git
- PostgreSQL client (psql)
- GitHub account
- Supabase account (free)
- Vercel account (free)
- Expo account (free)

## Step 1: Database Setup (5 minutes)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new organization (free)
4. Create new project:
   - Name: `weflutgrid`
   - Database Password: (save this!)
   - Region: Choose closest to your users
5. Wait for project initialization (~2 minutes)

### 1.2 Get Connection String

1. Go to Project Settings → Database
2. Copy "Connection string" (URI format)
3. Replace `[YOUR-PASSWORD]` with your password
4. Save as `DATABASE_URL`

### 1.3 Initialize Database
```bash
# Clone repository
git clone https://github.com/yourusername/weflutgrid.git
cd weflutgrid

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and paste your DATABASE_URL
nano .env

# Run setup
npm run setup
```

## Step 2: Deploy Tile API (10 minutes)

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Login to Vercel
```bash
vercel login
```

### 2.3 Deploy Tiles API
```bash
cd vercel-tiles
npm install

# Deploy to production
vercel --prod

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing? No
# - Project name? weflutgrid-tiles
# - Directory? ./
```

### 2.4 Add Environment Variable
```bash
# Add DATABASE_URL to Vercel
vercel env add DATABASE_URL
# Paste: production
# Value: [Your Supabase connection string]

# Redeploy with env var
vercel --prod
```

### 2.5 Note Your Tile URL
```bash
# Your tiles are now at:
https://weflutgrid-tiles.vercel.app/tiles/{z}/{x}/{y}.geojson
```

## Step 3: Setup GitHub Actions ETL (5 minutes)

### 3.1 Add GitHub Secret

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DATABASE_URL`
5. Value: Your Supabase connection string
6. Click "Add secret"

### 3.2 Test ETL Manually
```bash
# Go to Actions tab in GitHub
# Click "UK Land Registry ETL"
# Click "Run workflow"
# Click "Run workflow" button
# Wait ~10-15 minutes
```

## Step 4: Deploy Mobile App (5 minutes)

### 4.1 Update Config
```bash
cd mobile

# Edit app.json
nano app.json

# Update "extra.tileApiUrl" with your Vercel URL:
{
  "extra": {
    "tileApiUrl": "https://weflutgrid-tiles.vercel.app"
  }
}
```

### 4.2 Install Dependencies
```bash
npm install
```

### 4.3 Start Development Server
```bash
npx expo start
```

### 4.4 Test on Device

1. Install "Expo Go" app on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Scan QR code from terminal

3. App should load with map showing property data!

## Step 5: Initial Data Load (15 minutes)

### 5.1 Download Sample Data
```bash
# Back to root directory
cd ..

# Download UK postcode lookup
node scripts/download_postcodes.js

# Download sample property data
curl -L "https://landregistry.data.gov.uk/data/ppi/pp-monthly-update.csv" \
  -o data/uk_ppd_sample.csv

# Take first 100k rows
head -n 100000 data/uk_ppd_sample.csv > data/uk_ppd_trimmed.csv
```

### 5.2 Run Initial ETL
```bash
npm run etl
```

### 5.3 Verify Data
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM heatmap_cells;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM heatmap_aggregated;"
```

## Verification Checklist

- [ ] Database schema created in Supabase
- [ ] Tile API deployed to Vercel
- [ ] GitHub Actions ETL configured
- [ ] Mobile app running on device
- [ ] Data visible in app
- [ ] Hexagons show property prices
- [ ] Popup displays details on tap

## Troubleshooting

### Database Connection Fails
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# If fails, check:
# 1. Connection string format
# 2. Password is correct
# 3. IP not blocked (Supabase allows all by default)
```

### Tile API Returns Empty Features
```bash
# Check if data exists
psql $DATABASE_URL -c "SELECT COUNT(*) FROM heatmap_aggregated;"

# If 0, run ETL:
npm run etl

# If >0, check H3 level in query
```

### Mobile App Doesn't Show Tiles
```bash
# 1. Check tile URL in app.json
# 2. Test tile endpoint:
curl https://your-project.vercel.app/tiles/10/512/341.geojson

# 3. Check device console logs in Expo
```

### ETL Job Fails in GitHub Actions
```bash
# Check logs in Actions tab
# Common issues:
# 1. DATABASE_URL secret not set
# 2. Postcode cache miss (re-run to cache)
# 3. Timeout (reduce max_rows input)
```

## Monthly Maintenance

### Free Tier Limits

Monitor usage:
- Supabase: 500MB database (check in dashboard)
- Vercel: 100GB bandwidth (check in dashboard)
- GitHub Actions: 2000 minutes (check in settings)

### Scaling Strategy

When you hit limits:

**Database (500MB → 4GB): $0 → $25/month**
- Migrate to Railway.app or DigitalOcean

**Bandwidth (100GB → 1TB): $0 → $20/month**
- Upgrade Vercel Pro

**ETL (2000min → unlimited): $0 → $10/month**
- Move to dedicated EC2/DigitalOcean droplet

## Production Checklist

Before going live:

- [ ] Add custom domain to Vercel
- [ ] Enable SSL (automatic with Vercel)
- [ ] Setup error monitoring (Sentry free tier)
- [ ] Add analytics (Plausible/Google Analytics)
- [ ] Create privacy policy
- [ ] Submit to App Store/Play Store (when ready)
- [ ] Setup automated backups
- [ ] Configure rate limiting
- [ ] Add terms of service

## Cost Projection

| Users | Monthly Cost | Infrastructure |
|-------|--------------|----------------|
| 0-1000 | $0 | Free tiers |
| 1K-10K | $50 | Railway + Vercel Pro |
| 10K-100K | $200 | Managed services |
| 100K+ | $500+ | Dedicated infrastructure |

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/weflutgrid/issues)
- Docs: [Documentation](../README.md)
- Email: your-email@example.com