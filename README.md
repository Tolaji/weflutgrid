# WeflutGrid – Global Property Price Heatmap

## Overview

As a full-stack software engineer passionate about geospatial systems and zero-cost scalable architecture, I built **WeflutGrid** to master the end-to-end challenges of processing and visualizing tens of millions of real-world property transactions — entirely on free-tier infrastructure.

WeflutGrid is an interactive hexagonal heatmap that reveals property price trends across the United Kingdom at any zoom level: from nationwide patterns down to individual streets. Using Uber’s H3 geospatial indexing system, the platform aggregates official government property sales into color-coded hexagons, delivering sub-100ms tile responses via serverless edge functions.

**How to use it**  
- Open the mobile app (iOS/Android) or web version  
- Pan and zoom freely — the map dynamically loads higher-resolution hexagons as you zoom in  
- Tap any hexagon to see:  
  - Median sale price  
  - Number of transactions  
  - Confidence score (based on sample size and recency)  
- Green = lower prices, Yellow = average, Red = higher prices  
- Hexagon opacity reflects data confidence (more transactions = more opaque)

**Data sources**  
- **UK Land Registry Price Paid Data** – 30+ million transactions since 1995 (official, monthly updated)  
  → http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/  
-csv-files  
- **Open Postcode Geo** – 1.7M+ UK postcodes with lat/lng  
  → https://www.getthedata.com/open-postcode-geo

**My purpose**  
To prove that a production-grade, globally performant geospatial platform can be built and operated at **$0/month** while handling 30M+ records, using only modern serverless tools, clever indexing (H3), streaming ETL, and aggressive free-tier optimization.

[Software Demo Video (5:00)](https://youtu.be/ZlXIChF1Tgo)  
→ Live mobile + web demo, ETL pipeline walkthrough H3 indexing explanation Vercel tile API deep dive

## Development Environment

- **IDE**: Visual Studio Code + TypeScript ESLint + Prettier  
- **Version Control**: Git + GitHub (Conventional Commits)  
- **Database**: PostgreSQL 15 on Supabase (PostGIS + H3 extensions, materialized views)  
- **Backend**: Vercel Edge Functions (Node.js 20 runtime)  
- **Mobile & Web**: Expo SDK 51 + React Native 0.74 + React Native Web  
- **CI/CD**: GitHub Actions (weekly automated ETL using 2000 free minutes/month)  
- **Testing & Debugging**: Postman, React Native Debugger, Supabase Dashboard, Vercel CLI  

**Programming Languages**  
- TypeScript / JavaScript (ES Modules)  
- SQL (PostgreSQL + PostGIS + H3 functions)

**Key Libraries**  
- `h3-js` – Uber H3 hexagonal indexing  
- `pg` – PostgreSQL client  
- `csv-parser` – Streaming CSV processing (memory-efficient for 1GB+ files)  
- `react-native-maps` / `leaflet` – Native and web mapping  
- `zustand` – Lightweight state management  
- `@vercel/postgres – Serverless-optimized DB adapter

## Useful Websites

- [H3 Documentation](https://h3geo.org/) – Hexagonal hierarchical spatial index  
- [PostGIS Documentation](https://postgis.net/docs/) – Spatial database extender  
- [UK Land Registry Open Data](http://landregistry.data.gov.uk/) – Official price paid dataset  
- [Open Postcode Geo](https://www.getthedata.com/open-postcode-geo) – Free UK postcode → lat/lng  
- [Vercel Edge Functions](https://vercel.com/docs/concepts/functions/edge-functions) – Global low-latency APIs  
- [Supabase PostgreSQL](https://supabase.com/docs) – Free-tier Postgres with extensions  
- [Expo Documentation](https://docs.expo.dev/) – Cross-platform React Native  
- [React Native Maps](https://github.com/react-native-maps/react-native-maps) – Native map components

## Future Work

**Must-Fix**
- Memory leak in tile rendering (polygon components not unmounting on pan/zoom)
- Prevent concurrent ETL runs (avoid duplicate insertions during overlapping schedules)
- Replace in-memory postcode cache with Redis for faster cold starts

**Performance**
- CDN cache warming for popular UK regions (London, Manchester, etc.)
- Composite indexes on `(country_code, h3_level, metric_type)`
- Simplify hexagon geometry at low zoom levels (reduce vertex count)
- Move GeoJSON parsing to Web Workers

**New Features**
- Global coverage: US (FHFA), EU (Eurostat), international (Numbeo)
- Time-series animation slider (watch prices evolve 1995→today)
- Comparison mode (side-by-side regions or years)
- Custom area drawing + aggregate stats
- Dark mode, offline tile caching, PWA install prompt
- Property-type filters (detached, flat, new-build, etc.)

**Infrastructure & Quality**
- Full TypeScript migration of ETL scripts
- Jest + React Testing Library automated tests
- Sentry error monitoring + performance tracing
- API versioning (/v1/tiles → /v2/tiles)
- Architecture Decision Records (ADRs)

**Current Stats**  
- Lines of code: ~15,000  
- Data processed: 30M+ transactions  
- Hexagons generated: 2M+ across resolutions  
- Monthly cost: **$0** (Supabase + Vercel + GitHub Actions free tiers)  
- p95 tile response time: **<100ms**

