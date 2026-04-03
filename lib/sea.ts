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

    // Normal: "WNW at 18.0 mph"
    const m = html.match(/Wind<\/td>\s*<td[^>]*>(?:<[^>]+>)*([A-Z]{1,3})\s+at\s+([\d.]+)\s+mph/)
    if (m) return { wind_dir: m[1], wind_speed: parseFloat(m[2]) }

    // Calm: Davis stations report "Calm" when wind speed is 0
    const calm = html.match(/Wind<\/td>\s*<td[^>]*>(?:<[^>]+>)*Calm/)
    if (calm) return { wind_dir: 'Calm', wind_speed: 0 }

    return { wind_speed: null, wind_dir: null }
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
// HTML structure:
//   <h2>Gibraltar Point to North Foreland (5)</h2>
//   <p>Strong winds are forecast</p>  ← optional warning
//   <h3>24 hour forecast:</h3>
//   <p><strong>Wind</strong></p><p>TEXT</p>
//   <p><strong>Sea state</strong></p><p>TEXT</p>
//   <p><strong>Weather</strong></p><p>TEXT</p>
//   <p><strong>Visibility</strong></p><p>TEXT</p>
//   <h3>Outlook for the following 24 hours:</h3>  ← same structure
//
// Returns a JSON string (MetOfficeForecastData) stored in sea_snapshots.metoffice_forecast

export type MetOfficeForecastData = {
  title:   string
  warning: string | null
  forecast: ForecastPeriod
  outlook:  ForecastPeriod
}

type ForecastPeriod = {
  wind:       string | null
  sea_state:  string | null
  weather:    string | null
  visibility: string | null
}

function extractField(html: string, label: string): string | null {
  // Matches: <strong>Wind</strong></p> <p>VALUE</p>
  const re = new RegExp(
    `<strong>\\s*${label}\\s*<\\/strong>\\s*<\\/p>\\s*<p>([^<]+)`, 'i'
  )
  const m = html.match(re)
  return m ? m[1].trim() : null
}

function parsePeriod(html: string): ForecastPeriod {
  return {
    wind:       extractField(html, 'Wind'),
    sea_state:  extractField(html, 'Sea state'),
    weather:    extractField(html, 'Weather'),
    visibility: extractField(html, 'Visibility'),
  }
}

export async function fetchMetOfficeForecast(): Promise<string | null> {
  try {
    const res = await fetch(
      'https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/inshore-waters-forecast',
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const html = await res.text()

    // Locate the Gibraltar Point <h2> and bound to the next <h2>
    const idx = html.indexOf('Gibraltar Point')
    if (idx === -1) return null
    const sectionStart = html.lastIndexOf('<h2', idx)
    if (sectionStart === -1) return null
    const nextH2 = html.indexOf('<h2', sectionStart + 10)
    const section = html.slice(sectionStart, nextH2 !== -1 ? nextH2 : sectionStart + 4000)

    // Optional warning line between </h2> and first <h3>
    const warningMatch = section.match(/<\/h2>\s*<p>([^<]+)<\/p>\s*<h3/i)
    const warning = warningMatch ? warningMatch[1].trim() : null

    // Split into 24hr and outlook parts at the second <h3>
    const h3s = [...section.matchAll(/<h3/gi)]
    const outlookStart = h3s[1] ? h3s[1].index! : section.length
    const forecastHtml = section.slice(0, outlookStart)
    const outlookHtml  = section.slice(outlookStart)

    const data: MetOfficeForecastData = {
      title:    'Gibraltar Point to North Foreland (5)',
      warning,
      forecast: parsePeriod(forecastHtml),
      outlook:  parsePeriod(outlookHtml),
    }

    return JSON.stringify(data)
  } catch {
    return null
  }
}
