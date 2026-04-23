# Source Strategy

## Goal

The source strategy should maximize coverage and freshness without making the product fragile. The engine should prefer reliable structured sources first, then managed extraction, then custom crawling only when needed.

## Three Ingestion Pillars

### 1. Structured Feeds And APIs

Use these first whenever possible.

- RSS feeds for company blogs, podcasts, newsrooms, and industry publications.
- YouTube Data API / uploads playlists for channel monitoring.
- Greenhouse job board API.
- Lever postings API.
- Other official source APIs where available.

Why this matters:

- Reliable.
- Cheap.
- Easy to schedule.
- Easy to dedupe.
- Ideal for continuous monitoring.

### 2. Managed Web And Social Extraction

Use these when a source has no clean API/feed or when the platform has anti-bot protection.

- Firecrawl for normal web pages, sitemaps, rendering, markdown, and structured extraction.
- Bright Data for LinkedIn, Xing, social profiles, social search, protected pages, high-success scraping, and anti-bot-heavy targets.
- WebShare for baseline proxy rotation when custom adapters need outbound proxying.

LinkedIn and social platforms should not be handled through fragile homegrown logged-in bots. Use managed providers that return structured data and handle session/proxy/CAPTCHA complexity.

### 3. Multimedia Intelligence

Use multimedia processing for high-value sources where spoken content contains sales signals.

- Podcasts.
- Webinars.
- YouTube videos.
- Executive interviews.
- Earnings/interview-style media.

Flow:

```text
metadata / RSS item
  -> hot-path relevance check
  -> download media to S3
  -> transcribe
  -> Nebius AI Studio structured extraction
  -> timeline + search + recommendations
```

## Collection Priority

1. Official API.
2. RSS/feed/structured endpoint.
3. Conditional HTTP fetch with ETag / Last-Modified.
4. Firecrawl managed extraction.
5. Bright Data social/protected extraction.
6. Custom Go adapter with WebShare proxying.

## Source Types For Lead Generation

- Job postings and ATS boards.
- Company blogs and newsrooms.
- Industry RSS feeds.
- YouTube channels.
- Podcast feeds.
- LinkedIn/company/social search through Bright Data or equivalent provider.
- Public company pages.
- User-added target URLs.

Lead generation sources are broad and ICP-driven.

## Source Types For Monitoring

- Company domain and sitemap.
- Company RSS/newsroom/blog.
- Careers page / ATS board.
- YouTube channel.
- Podcast mentions.
- LinkedIn/company profile and selected public people through managed provider.
- User-added URLs.
- Auto-discovered high-value sources.

Monitoring sources are account-specific and deeper than lead-generation sources.

## Source Registry Requirements

Each source must store:

- owner context: ICP rule or watchlisted account
- adapter type
- URL or external identifier
- cadence
- last observed state
- dedupe key strategy
- proxy/extraction provider
- cost category
- enabled/disabled state
- failure count
- last successful fetch time

## Social Platform Policy

Social data is valuable but risky. The product should:

- use managed providers for LinkedIn/Xing/social where possible
- store only necessary public business context
- log provenance and provider
- support suppression and deletion
- avoid user-owned personal login automation
- treat personal data as regulated and audit-sensitive

## When To Use Firecrawl vs Bright Data

| Need | Preferred tool |
| --- | --- |
| Normal website / blog / careers page | Firecrawl |
| Sitemap discovery | Firecrawl |
| JavaScript-heavy public page | Firecrawl first, Bright Data if blocked |
| LinkedIn / Xing / protected social | Bright Data |
| High anti-bot success requirement | Bright Data |
| Cheap proxy for custom adapter | WebShare |

## Success Criteria

- A source can be added manually and starts scheduled checks automatically.
- The engine can auto-discover obvious sources from a company domain.
- Every fetched item has a dedupe key.
- Failed sources do not block other sources.
- Expensive providers are used intentionally and logged.
