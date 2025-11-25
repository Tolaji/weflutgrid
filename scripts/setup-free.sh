#/bin/bash
set -e

echo "🆓 WeflutGrid Free Setup"
echo "========================"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL client required"; exit 1; }

echo "✅ Prerequisites checked"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Setup environment
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo "⚠️  Please edit .env with your Supabase connection string"
  echo ""
  read -p "Press enter when you've updated .env..."
fi

# Load environment
source .env

# Test database connection
echo "🔌 Testing database connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1 || {
  echo "❌ Database connection failed"
  echo "   Check your DATABASE_URL in .env"
  exit 1
}
echo "✅ Database connected"
echo ""

# Initialize database
echo "🗄️  Initializing database schema..."
psql "$DATABASE_URL" < database/schema.sql
echo "✅ Schema created"
echo ""

# Load sample data
read -p "Load sample data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  psql "$DATABASE_URL" < database/seeds/sample_data.sql
  echo "✅ Sample data loaded"
fi
echo ""

# Download postcode lookup
echo "📍 Downloading UK postcode lookup..."
if [ ! -f data/postcodes/postcodes.csv ]; then
  mkdir -p data/postcodes
  node scripts/download_postcodes.js
  echo "✅ Postcode lookup downloaded"
else
  echo "ℹ️  Postcode lookup already exists"
fi
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy tile API: cd vercel-tiles && vercel --prod"
echo "  2. Run mobile app: cd mobile && npx expo start"
echo "  3. Run ETL: npm run etl"