// Temporary debug endpoint — DELETE after diagnosing WSC and Met Office fetch issues
import { NextRequest, NextResponse } from 'next/server'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
}

async function testFetch(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', headers: BROWSER_HEADERS })
    const text = await res.text()
    return {
      status: res.status,
      ok: res.ok,
      content_length: text.length,
      has_gibraltar: text.includes('Gibraltar Point'),
      has_wind_td: text.includes('Wind</td>'),
      has_wind_font: text.includes('Wind') && text.includes('mph'),
      snippet_500: text.slice(0, 500),
    }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [wsc, metoffice] = await Promise.all([
    testFetch('https://waldringfieldsc.com/weather/Current_Vantage_ProNew2.htm'),
    testFetch('https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/inshore-waters-forecast'),
  ])

  return NextResponse.json({ wsc, metoffice })
}
