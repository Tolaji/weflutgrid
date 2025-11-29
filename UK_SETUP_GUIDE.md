# UK Property Heatmap Setup Guide

This guide will help you set up the WeflutGrid project for UK property data visualization.

## Prerequisites

- Node.js 18+
- PostgreSQL client (psql)
- Supabase account (free tier)
- Vercel account (free tier)
- UK Land Registry data (pp-2025.csv)

## Step 1: Download UK Land Registry Data

1. Download the latest UK Land Registry data:
   ```
   http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-2025.csv
   ```

2. Save it as `pp-2025.csv` in your project root directory

## Step 2: Set Up Database

1. Go to [supabase.com](https://supabase.com)
2. Create a new project (free tier)
3. Get your connection string from Project Settings → Database
4. Create a `.env` file in your project root with:
   ```
   DATABASE_URL=your_connection_string_here
   ```

## Step 3: Initialize Database

1. Run the setup script:
   ```
   node scripts/setup-final.js
   ```

## Step 4: Download Postcode Data

1. Run the postcode download script:
   ```
   node scripts/download_postcodes.js
   ```

## Step 5: Process Property Data

1. Prepare the data file:
   ```
   mkdir -p data
   head -n 100000 pp-2025.csv > data/uk_ppd_trimmed.csv
   ```

2. Run the ETL process:
   ```
   node scripts/etl_uk_optimized.js
   ```

## Step 6: Deploy Tile API

1. Go to the vercel-tiles directory:
   ```
   cd vercel-tiles
   npm install
   vercel --prod
   ```

2. Save the URL Vercel gives you (e.g., https://your-project.vercel.app)

## Step 7: Update Mobile App

1. Edit `weflutgrid-mobile/app.json`
2. Update the `extra.tileApiUrl` with your Vercel URL:
   ```json
   {
     "extra": {
       "tileApiUrl": "https://your-project.vercel.app"
     }
   }
   ```

## Step 8: Run Mobile App

1. Go to the mobile app directory:
   ```
   cd weflutgrid-mobile
   npm install
   npx expo start
   ```

2. Scan the QR code with Expo Go on your mobile device

## Troubleshooting

### No Data Showing in Map

1. Check if data exists in database:
   ```
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM heatmap_cells;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM heatmap_aggregated;"
   ```

2. Test tile API directly:
   ```
   curl "https://your-project.vercel.app/tiles/10/512/341.geojson" | jq '.features | length'
   ```

3. Check mobile app logs in Expo

### Database Connection Issues

1. Test connection:
   ```
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. Check your DATABASE_URL in .env file

## Next Steps

Once you have the UK heatmap working, you can:

1. Add more data by increasing MAX_ROWS in the ETL script
2. Add other countries' data sources
3. Customize the visualization colors and filters
4. Deploy to app stores

## Resources

- [UK Land Registry Data](http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/)
- [H3 Documentation](https://h3geo.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Expo Documentation](https://docs.expo.dev/)