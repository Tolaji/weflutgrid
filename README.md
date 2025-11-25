# WeflutGrid - Global Property Price Heatmap

Zero-budget implementation of a global property price visualization platform using H3 hexagons.

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- Free Supabase account
- Free Vercel account
- GitHub account

### Setup

1. **Clone and install**
```bash
git clone https://github.com/yourusername/weflutgrid.git
cd weflutgrid
npm install
```

2. **Setup Supabase**
- Go to [supabase.com](https://supabase.com)
- Create new project (free tier)
- Copy connection string
- Run: `cp .env.example .env`
- Paste connection string in `.env`

3. **Initialize database**
```bash
npm run setup
```

4. **Deploy tile API**
```bash
cd vercel-tiles
npm install
vercel --prod
# Copy the URL
```

5. **Run mobile app**
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go
```

## 📊 Architecture

- **Database**: Supabase (PostgreSQL + PostGIS + H3)
- **ETL**: GitHub Actions (automated weekly)
- **Tiles**: Vercel Edge Functions (global CDN)
- **Mobile**: React Native + Expo

## 💰 Cost

**$0/month** on free tiers:
- Supabase: 500MB database
- Vercel: 100GB bandwidth
- GitHub Actions: 2000 minutes
- Expo: Unlimited

## 📖 Documentation

See `/docs` folder for detailed guides:
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [ETL Pipeline](docs/ETL.md)

## 🤝 Contributing

Pull requests welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## 📄 License

MIT License - see LICENSE file