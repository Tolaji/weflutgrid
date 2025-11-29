#!/bin/bash
# Complete setup script for UK Land Registry data processing
echo "🇬🇧 WeflutGrid UK Land Registry ETL - Complete Setup"
echo "===================================================="
echo ""

# Step 1: Verify prerequisites
echo "📋 Step 1: Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL client required"; exit 1; }
if [ ! -f .env ]; then
echo "❌ .env file not found. Create it with your DATABASE_URL"
exit 1
fi
source .env
if [ -z "$DATABASE_URL" ]; then
echo "❌ DATABASE_URL not set in .env"
exit 1
fi
echo "✅ Prerequisites verified"
echo ""

# Step 2: Download postcode lookup if not exists
echo "📍 Step 2: Setting up postcode geocoding..."
if [ ! -f data/postcodes/postcodes.csv ]; then
echo "   Downloading UK postcode lookup (this takes ~3 minutes)..."
node scripts/download_postcodes.js
else
echo "   ✅ Postcode lookup already exists"
fi
echo ""

# Step 3: Process your downloaded UK data
echo "📦 Step 3: Processing UK Land Registry data..."
# Check if pp-2025.csv exists
if [ ! -f pp-2025.csv ]; then
echo "❌ pp-2025.csv not found in current directory"
echo "   Please ensure you've downloaded it from:"
echo "   http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-2025.csv"
exit 1
fi

# Create data directory
mkdir -p data
# Move and prepare the file
echo "   Preparing data file..."
cp pp-2025.csv data/uk_ppd_full.csv
# For free tier, take first 100k rows (or adjust as needed)
echo "   Taking sample for processing..."
head -n 100000 data/uk_ppd_full.csv > data/uk_ppd_trimmed.csv
echo "   ✅ $(wc -l < data/uk_ppd_trimmed.csv) rows ready for processing"
echo ""

# Step 4: Verify database connection
echo "🔌 Step 4: Testing database connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1 || {
echo "❌ Database connection failed"
echo "   Check your DATABASE_URL in .env"
exit 1
}
echo "✅ Database connected"
echo ""

# Step 5: Initialize database schema if needed
echo "🗄️  Step 5: Checking database schema..."
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'heatmap_cells');")
if [[ "$TABLE_EXISTS" =~ "f" ]]; then
echo "   Creating database schema..."
node scripts/setup-final.js
else
echo "   ✅ Schema already exists"
fi
echo ""

# Step 6: Run ETL process
echo "🚀 Step 6: Running ETL process..."
echo "   This will take 5-10 minutes for 100k rows..."
echo ""
node scripts/etl_github_action.js
echo ""

# Step 7: Verify data loaded
echo "🧪 Step 7: Verifying data..."
CELL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM heatmap_cells;")
AGG_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM heatmap_aggregated;")
echo "   ✅ Heatmap cells: $CELL_COUNT"
echo "   ✅ Aggregated view: $AGG_COUNT"
echo ""

# Step 8: Show sample data
echo "📊 Step 8: Sample data preview..."
psql "$DATABASE_URL" -c "
SELECT 
h3_index,
country_code,
region,
metric_value as price,
transaction_count,
confidence_score
FROM heatmap_cells 
ORDER BY updated_at DESC 
LIMIT 5;
"
echo ""

# Step 9: Next steps
echo "🎉 ETL COMPLETE!"
echo ""
echo "📱 Next Steps:"
echo ""
echo "1️⃣  Deploy Tile API to Vercel:"
echo "   cd vercel-tiles"
echo "   npm install"
echo "   vercel --prod"
echo ""
echo "2️⃣  Update mobile app with your Vercel URL:"
echo "   Edit weflutgrid-mobile/app.json"
echo "   Update 'extra.tileApiUrl' with your Vercel URL"
echo ""
echo "3️⃣  Run mobile app:"
echo "   cd weflutgrid-mobile"
echo "   npm install"
echo "   npx expo start"
echo ""
echo "💡 To process more data, adjust MAX_ROWS in scripts/etl_github_action.js"
echo "   Current: 100,000 rows (fits in free tier)"
echo "   Full dataset: ~30M rows (requires paid tier)"