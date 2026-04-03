// Fetch a single price from Yahoo Finance (no API key required)
// Symbols: GC=F (Gold), CL=F (WTI Oil), GBPUSD=X (GBP/USD), ^FTSE (FTSE 100)
async function yahooPrice(symbol: string): Promise<number | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bc-dashboard/1.0)' },
      cache: 'no-store',
    })
    if (!r.ok) return null
    const j = await r.json()
    const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch {
    return null
  }
}

export type MarketData = {
  gold: number | null   // USD per troy oz
  oil:  number | null   // USD per barrel (WTI)
  gbpusd: number | null // GBP/USD rate
  ftse: number | null   // FTSE 100 index points
}

export async function fetchMarketData(): Promise<MarketData> {
  const [gold, oil, gbpusd, ftse] = await Promise.allSettled([
    yahooPrice('GC=F'),
    yahooPrice('CL=F'),
    yahooPrice('GBPUSD=X'),
    yahooPrice('^FTSE'),
  ])

  return {
    gold:   gold.status   === 'fulfilled' ? gold.value   : null,
    oil:    oil.status    === 'fulfilled' ? oil.value    : null,
    gbpusd: gbpusd.status === 'fulfilled' ? gbpusd.value : null,
    ftse:   ftse.status   === 'fulfilled' ? ftse.value   : null,
  }
}
