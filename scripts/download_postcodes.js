#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const POSTCODE_URL = 'https://www.getthedata.com/downloads/open_postcode_geo.csv.zip';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'postcodes');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'postcodes.zip');

async function download() {
  console.log('📥 Downloading UK postcode data...');
  console.log('   This may take 2-3 minutes (50MB file)');
  
  // Ensure directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    https.get(POSTCODE_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(OUTPUT_FILE);
      let downloaded = 0;
      const totalSize = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}%`);
      });

      streamPipeline(response, fileStream)
        .then(() => {
          console.log('\n✅ Download complete');
          resolve();
        })
        .catch(reject);
    }).on('error', reject);
  });
}

async function unzip() {
  console.log('📦 Extracting archive...');
  
  const { execSync } = require('child_process');
  
  try {
    execSync(`unzip -o "${OUTPUT_FILE}" -d "${OUTPUT_DIR}"`, {
      stdio: 'inherit'
    });
    
    // Rename to standard name
    const files = fs.readdirSync(OUTPUT_DIR);
    const csvFile = files.find(f => f.endsWith('.csv') && f !== 'postcodes.csv');
    
    if (csvFile) {
      fs.renameSync(
        path.join(OUTPUT_DIR, csvFile),
        path.join(OUTPUT_DIR, 'postcodes.csv')
      );
    }
    
    // Clean up zip
    fs.unlinkSync(OUTPUT_FILE);
    
    console.log('✅ Extraction complete');
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.log('   Please manually extract the file');
  }
}

async function main() {
  try {
    await download();
    await unzip();
    
    console.log('');
    console.log('🎉 Postcode lookup ready!');
    console.log(`   Location: ${OUTPUT_DIR}/postcodes.csv`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { download, unzip };