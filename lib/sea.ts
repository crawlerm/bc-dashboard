// Sea conditions data fetchers

// ── Wbtide Supabase (Fort Massac met data, public read) ──────────────────
const WBTIDE_URL = 'https://otxwipspvafbgbemfbqy.supabase.co'
const WBTIDE_KEY = 'sb_publishable_QzT5boJEpvDRntDKCiPojQ_oE7eG53B'

export type FtmData = {
  wind_speed: number | null  // knots
  wind_dir:   number | null  // degrees
  gust_speed: number | null  // knots
  gust_dir:   number | null  // degrees
  pressure:   number | null  // mb
  temp:       number | null  // °C
  humidity:   number | null  // %
}

export type WscData = {
  wind_speed: number | null  // mph
  wind_dir:   string | null  // compass e.g. "WNW"
}

export type CefasData = {
  wave_height: number | null  // m (Hm0)
  sea_temp:    number | null  // °C
  wave_dir:    number | null  // degrees
  timestamp:   string | null
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

// ── Fort Massac: latest row from wbtide Supabase ──────────────────────────
export async function fetchFtmassac(): Promise<FtmData> {
  const nil: FtmData = {
    wind_speed: null, wind_dir: null,
    gust_speed: null, gust_dir: null,
    pressure: null, temp: null, humidity: null,
  }
  try {
    const res = await fetch(
      `${WBTIDE_URL}/rest/v1/ftmassac?select=*&order=DateTime.desc&limit=1`,
      {
        headers: {
          apikey: WBTIDE_KEY,
          Authorization: `Bearer ${WBTIDE_KEY}`,
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) return nil
    const rows = await res.json() as Record<string, unknown>[]
    if (!rows.length) return nil
    const r = rows[0]
    return {
      wind_speed: toNum(r['Wind Speed']),
      wind_dir:   toNum(r['Wind Direction']),
      gust_speed: toNum(r['Gust Speed']),
      gust_dir:   toNum(r['Gust Direction']),
      pressure:   toNum(r['Atmos Pressure']),
      temp:       toNum(r['Temperature']),
      humidity:   toNum(r['Humidity']),
    }
  } catch {
    return nil
  }
}

// ── Waldringfield SC: scrape wind from Davis weather page ─────────────────
export async function fetchWaldringfield(): Promise<WscData> {
  try {
    const res = await fetch(
      'https://waldringfieldsc.com/weather/Current_Vantage_ProNew2.htm',
      { cache: 'no-store' }
    )
    if (!res.ok) return { wind_speed: null, wind_dir: null }
    const html = await res.text()
    // Row contains e.g. "WNW at 18.0 mph" inside a <font> tag
    const m = html.match(/Wind<\/td>\s*<td[^>]*>(?:<[^>]+>)*([A-Z]{1,3})\s+at\s+([\d.]+)\s+mph/)
    if (!m) return { wind_speed: null, wind_dir: null }
    return { wind_dir: m[1], wind_speed: parseFloat(m[2]) }
  } catch {
    return { wind_speed: null, wind_dir: null }
  }
}

// ── CEFAS Felixstowe WaveNet buoy ─────────────────────────────────────────
export async function fetchCefas(): Promise<CefasData> {
  const nil: CefasData = { wave_height: null, sea_temp: null, wave_dir: null, timestamp: null }
  try {
    const res = await fetch(
      'https://wavenet-api.cefas.co.uk/api/Detail/Results/367/EXT?showForecast=false',
      { cache: 'no-store' }
    )
    if (!res.ok) return nil
    const data = await res.json() as Array<{
      timestamp: string
      isForecast: boolean
      results: Array<{ identifier: string; value: string }>
    }>
    const actuals = data.filter(d => !d.isForecast)
    if (!actuals.length) return nil
    // Sort descending to get latest
    actuals.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const latest = actuals[0]
    const get = (id: string): number | null => {
      const r = latest.results.find(x => x.identifier === id)
      return r ? toNum(r.value) : null
    }
    return {
      wave_height: get('Hm0'),
      sea_temp:    get('TEMP'),
      wave_dir:    get('W_PDIR'),
      timestamp:   latest.timestamp,
    }
  } catch {
    return nil
  }
}

// ── Met Office inshore forecast — Gibraltar Point to North Foreland ────────
// Structure: <h2>Gibraltar Point to North Foreland (5)</h2>
//   <h3>24 hour forecast:</h3>
//   <p><strong>Wind</strong></p><p>...</p>
//   <p><strong>Sea state</strong></p><p>...</p>
//   <p><strong>Weather</strong></p><p>...</p>
//   <p><strong>Visibility</strong></p><p>...</p>
//   <h3>Outlook for the following 24 hours:</h3> ...
export async function fetchMetOfficeForecast(): Promise<string | null> {
  try {
    const res = await fetch(
      'https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/inshore-waters-forecast',
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const html = await res.text()

    // Find the <h2> that contains "Gibraltar Point"
    const idx = html.indexOf('Gibraltar Point')
    if (idx === -1) return null
    const sectionStart = html.lastIndexOf('<h2', idx)
    if (sectionStart === -1) return null

    // Slice to the next <h2> (the following region) to bound our section
    const nextH2 = html.indexOf('<h2', sectionStart + 10)
    const sectionEnd = nextH2 !== -1 ? nextH2 : sectionStart + 3000
    const chunk = html.slice(sectionStart, sectionEnd)

    // Convert structural tags to readable separators before stripping
    const text = chunk
      .replace(/<h2[^>]*>/gi, '')
      .replace(/<\/h2>/gi, '\n')
      .replace(/<h3[^>]*>/gi, '\n')
      .replace(/<\/h3>/gi, '\n')
      .replace(/<\/p>/gi, ' ')
      .replace(/<strong>/gi, '')
      .replace(/<\/strong>/gi, ': ')
      .replace(/<[^>]+>/g, '')           // strip remaining tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .replace(/[ \t]{2,}/g, ' ')        // collapse horizontal whitespace
      .replace(/\n{3,}/g, '\n\n')        // max 2 consecutive newlines
      .trim()

    return text
  } catch {
    return null
  }
}
