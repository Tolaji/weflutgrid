#!/usr/bin/env node
// setup_uk_data.js - Complete UK Land Registry ETL Setup (Pure Node.js – works everywhere)

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log("WeflutGrid UK Land Registry ETL - Complete Setup");
console.log("====================================================\n");

// Helper to run commands and throw nice errors
function run(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...options });
  } catch (err) {
    console.error(`Failed: ${cmd}`);
    if (err.stderr) console.error(err.stderr.trim());
    process.exit(1);
  }
}

// Helper for spawn (shows live output)
function runLive(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
}

// Change to project root
process.chdir(rootDir);

// Step 1: Prerequisites
console.log("Step 1: Checking prerequisites...");
try {
  run('node --version');
  run('psql --version');
} catch {
  console.error("Node.js and PostgreSQL client (psql) are required.");
  process.exit(1);
}

if (!fs.existsSync('.env')) {
  console.error(".env file not found. Create it with your DATABASE_URL");
  process.exit(1);
}

const envContent = fs.readFileSync('.env', 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("Prerequisites verified\n");

// Step 2: Postcode lookup
console.log("Step 2: Setting up postcode geocoding...");
const postcodePath = path.join('data', 'postcodes', 'postcodes.csv');
if (!fs.existsSync(postcodePath)) {
  console.log("   Downloading UK postcode lookup (~3 minutes)...");
  runLive('node', ['scripts/download_postcodes.js']);
} else {
  console.log("   Postcode lookup already exists");
}
console.log("");

// Step 3: Process Land Registry CSV
console.log("Step 3: Processing UK Land Registry data...");
const sourceCsv = 'pp-2025.csv';
if (!fs.existsSync(sourceCsv)) {
  console.error(`pp-2025.csv not found in project root`);
  console.error(`   Download it from:`);
  console.error(`   http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-2025.csv`);
  process.exit(1);
}

fs.mkdirSync('data', { recursive: true });
const fullPath = path.join('data', 'uk_ppd_full.csv');
const trimmedPath = path.join('data', 'uk_ppd_trimmed.csv');

if (!fs.existsSync(fullPath)) {
  console.log("   Copying data file...");
  fs.copyFileSync(sourceCsv, fullPath);
}

console.log("   Creating 100k-row sample (safe for free DB tiers)...");
const fullContent = fs.readFileSync(fullPath, 'utf-8');
const lines = fullContent.split(/\r?\n/);
const header = lines[0];
const sampleLines = lines.slice(0, 100001); // header + 100k rows
fs.writeFileSync(trimmedPath, sampleLines.join('\n'), 'utf-8');

console.log(`   ${sampleLines.length - 1} rows ready for processing\n`);

// Step 4: Test DB connection
console.log("Step 4: Testing database connection...");
try {
  run(`psql "${DATABASE_URL}" -c "SELECT version();"`);
  console.log("Database connected\n");
} catch {
  console.error("Database connection failed – check DATABASE_URL in .env");
  process.exit(1);
}

// Step 5: Setup schema if needed
console.log("Step 5: Checking database schema...");
const tableCheck = run(`psql "${DATABASE_URL}" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'heatmap_cells');"`, { encoding: 'utf-8' }).trim();

if (tableCheck === 'f') {
  console.log("   Creating schema...");
  runLive('node', ['scripts/setup-final.js']);
} else {
  console.log("   Schema already exists");
}
console.log("");

// Step 6: Run ETL
console.log("Step 6: Running ETL process (5–10 min for 100k rows)...\n");
runLive('node', ['scripts/etl_github_action.js']);
console.log("");

// Step 7: Verify counts
console.log("Step 7: Verifying loaded data...");
const cellCount = run(`psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM heatmap_cells;"`).trim();
const aggCount = run(`psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM heatmap_aggregated;"`).trim();
console.log(`   Heatmap cells: ${cellCount}`);
console.log(`   Aggregated view: ${aggCount}\n`);

// Step 8: Sample preview
console.log("Step 8: Sample data preview...");
run(`psql "${DATABASE_URL}" -c "
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
"`);
console.log("");

// Final success message
console.log("ETL COMPLETE!\n");
console.log("Next Steps:\n");
console.log("1. Deploy Tile API to Vercel:");
console.log("   cd vercel-tiles");
console.log("   npm install");
console.log("   vercel --prod\n");
console.log("2. Update mobile app with your Vercel URL:");
console.log("   Edit weflutgrid-mobile/app.json → extra.tileApiUrl\n");
console.log("3. Run the mobile app:");
console.log("   cd weflutgrid-mobile");
console.log("   npm install");
console.log("   npx expo start\n");
console.log("To process the full ~30M rows, edit MAX_ROWS in scripts/etl_github_action.js");
console.log("   (requires paid database tier)\n");