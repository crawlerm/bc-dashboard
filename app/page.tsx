import { supabase } from '@/lib/supabase'
import type { MetOfficeForecastData } from '@/lib/sea'

export const revalidate = 0  // Always fetch fresh — data changes 3x/day

// ── Finance types ─────────────────────────────────────────────────────────
type Snap = {
  id: number
  captured_at: string
  label: string
  gold_usd:  number | null
  oil_usd:   number | null
  gbp_usd:   number | null
  bank_rate: number | null
  ftse:      number | null
}

// ── Sea Conditions types ──────────────────────────────────────────────────
type SeaSnap = {
  id: number
  captured_at: string
  label: string
  ftm_wind_speed:    number | null
  ftm_wind_dir:      number | null
  ftm_gust_speed:    number | null
  ftm_gust_dir:      number | null
  ftm_pressure:      number | null
  ftm_temp:          number | null
  ftm_humidity:      number | null
  wsc_wind_speed:    number | null
  wsc_wind_dir:      string | null
  cefas_wave_height: number | null
  cefas_sea_temp:    number | null
  cefas_wave_dir:    number | null
  metoffice_forecast: string | null
}

// ── Direction arrow (>0.01% threshold) ───────────────────────────────────
function Arrow({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || prev == null) return <span style={{ color: '#aaa' }}>–</span>
  const pct = (curr - prev) / prev
  if (pct >  0.0001) return <span style={{ color: '#1a7f37', fontWeight: 'bold' }}>↑</span>
  if (pct < -0.0001) return <span style={{ color: '#cf222e', fontWeight: 'bold' }}>↓</span>
  return <span style={{ color: '#888' }}>→</span>
}

// ── Met Office forecast field renderer ───────────────────────────────────
type ForecastPeriod = { wind: string | null; sea_state: string | null; weather: string | null; visibility: string | null }
const LABEL: React.CSSProperties = { fontSize: '0.7rem', fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.1rem' }
const VALUE: React.CSSProperties = { margin: '0 0 0.5rem', color: '#222' }
function ForecastFields({ data }: { data: ForecastPeriod }) {
  return (
    <>
      {data.wind       && <><div style={LABEL}>Wind</div>       <p style={VALUE}>{data.wind}</p></>}
      {data.sea_state  && <><div style={LABEL}>Sea State</div>  <p style={VALUE}>{data.sea_state}</p></>}
      {data.weather    && <><div style={LABEL}>Weather</div>    <p style={VALUE}>{data.weather}</p></>}
      {data.visibility && <><div style={LABEL}>Visibility</div> <p style={VALUE}>{data.visibility}</p></>}
    </>
  )
}

// ── Formatters ────────────────────────────────────────────────────────────
const f2 = (n: number | null) =>
  n != null ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
const f4 = (n: number | null) =>
  n != null ? n.toFixed(4) : '—'
const f0 = (n: number | null) =>
  n != null ? n.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—'
const f1 = (n: number | null) =>
  n != null ? n.toFixed(1) : '—'

// Gold in GBP = Gold USD / GBP-USD rate
const goldGbp = (s: Snap) =>
  s.gold_usd != null && s.gbp_usd != null && s.gbp_usd > 0
    ? s.gold_usd / s.gbp_usd
    : null

// Convert compass degrees to 8-point abbreviation
function degToCompass(deg: number | null): string {
  if (deg == null) return '—'
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

export default async function Page() {
  // ── Fetch finance and sea data in parallel ────────────────────────────
  const [finResult, seaResult] = await Promise.all([
    supabase
      .from('finance_snapshots')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(9),
    supabase
      .from('sea_snapshots')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(6),
  ])

  if (finResult.error) {
    return <p style={{ padding: '1rem', color: '#cf222e' }}>Error loading finance data: {finResult.error.message}</p>
  }

  const snaps    = (finResult.data ?? []) as Snap[]
  const today    = snaps.slice(0, 3)
  const seaSnaps = (seaResult.data ?? []) as SeaSnap[]
  const seaToday = seaSnaps.slice(0, 3)

  const lastSnap = snaps[0]
  const lastTime = lastSnap
    ? new Date(lastSnap.captured_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC',
      }) + ' UTC'
    : null

  const latestForecastRaw = seaSnaps.find(s => s.metoffice_forecast)?.metoffice_forecast ?? null
  let latestForecast: MetOfficeForecastData | null = null
  try { if (latestForecastRaw) latestForecast = JSON.parse(latestForecastRaw) } catch { /* old plain-text row */ }

  // ── Shared styles ─────────────────────────────────────────────────────
  const TH: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    textAlign: 'right',
    fontWeight: '600',
    fontSize: '0.82rem',
    color: '#444',
    whiteSpace: 'nowrap',
  }
  const TD: React.CSSProperties = {
    padding: '0.45rem 0.75rem',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }
  const TDL: React.CSSProperties = { ...TD, textAlign: 'left', fontWeight: '600' }
  const sectionGap: React.CSSProperties = { marginTop: '1.75rem' }
  const noData = (cols: number) => (
    <tr>
      <td colSpan={cols} style={{ padding: '1.5rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
        No snapshots yet today — first capture at 0700 UTC
      </td>
    </tr>
  )

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Finance ─────────────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '600', color: '#333' }}>
        Finance —{' '}
        {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#f6f8fa', borderBottom: '2px solid #d0d7de' }}>
              <th style={{ ...TH, textAlign: 'left' }}>UTC</th>
              <th style={TH}>Gold £/oz</th>
              <th style={TH}>WTI $/bbl</th>
              <th style={TH}>£/$</th>
              <th style={TH}>Base rate</th>
              <th style={TH}>FTSE 100</th>
            </tr>
          </thead>
          <tbody>
            {today.length === 0 ? noData(6) : today.map((s, i) => {
              const prev = snaps[i + 1] ?? null
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #eaecef' }}>
                  <td style={TDL}>{s.label}</td>
                  <td style={TD}>{f2(goldGbp(s))}&nbsp;<Arrow curr={goldGbp(s)} prev={prev ? goldGbp(prev) : null} /></td>
                  <td style={TD}>{f2(s.oil_usd)}&nbsp;<Arrow curr={s.oil_usd} prev={prev?.oil_usd ?? null} /></td>
                  <td style={TD}>{f4(s.gbp_usd)}&nbsp;<Arrow curr={s.gbp_usd} prev={prev?.gbp_usd ?? null} /></td>
                  <td style={TD}>{s.bank_rate != null ? `${s.bank_rate.toFixed(2)}%` : '—'}</td>
                  <td style={TD}>{f0(s.ftse)}&nbsp;<Arrow curr={s.ftse} prev={prev?.ftse ?? null} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.72rem', color: '#999', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
        ↑↓ vs previous snapshot · Captured 0700, 1200, 1800 UTC · FTSE shown at last traded price
        {lastTime ? <> · Last update: {lastTime}</> : null}
      </p>

      {/* ── Sea Conditions ──────────────────────────────────────────── */}
      <div style={sectionGap}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '600', color: '#333' }}>
          Sea Conditions —{' '}
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </h2>

        {/* Fort Massac station */}
        <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: '600', color: '#555' }}>
          Fort Massac Station
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f6f8fa', borderBottom: '2px solid #d0d7de' }}>
                <th style={{ ...TH, textAlign: 'left' }}>UTC</th>
                <th style={TH}>Wind kn</th>
                <th style={TH}>Dir</th>
                <th style={TH}>Gust kn</th>
                <th style={TH}>Pressure mb</th>
                <th style={TH}>Temp °C</th>
                <th style={TH}>Humidity %</th>
              </tr>
            </thead>
            <tbody>
              {seaToday.length === 0 ? noData(7) : seaToday.map((s, i) => {
                const prev = seaSnaps[i + 1] ?? null
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eaecef' }}>
                    <td style={TDL}>{s.label}</td>
                    <td style={TD}>{f1(s.ftm_wind_speed)}&nbsp;<Arrow curr={s.ftm_wind_speed} prev={prev?.ftm_wind_speed ?? null} /></td>
                    <td style={TD}>{s.ftm_wind_dir != null ? `${degToCompass(s.ftm_wind_dir)} ${f0(s.ftm_wind_dir)}°` : '—'}</td>
                    <td style={TD}>{f1(s.ftm_gust_speed)}&nbsp;<Arrow curr={s.ftm_gust_speed} prev={prev?.ftm_gust_speed ?? null} /></td>
                    <td style={TD}>{f1(s.ftm_pressure)}&nbsp;<Arrow curr={s.ftm_pressure} prev={prev?.ftm_pressure ?? null} /></td>
                    <td style={TD}>{f1(s.ftm_temp)}&nbsp;<Arrow curr={s.ftm_temp} prev={prev?.ftm_temp ?? null} /></td>
                    <td style={TD}>{f1(s.ftm_humidity)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Waldringfield SC + Felixstowe Buoy side by side */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>

          {/* Waldringfield SC */}
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: '600', color: '#555' }}>
              Waldringfield SC
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f6f8fa', borderBottom: '2px solid #d0d7de' }}>
                    <th style={{ ...TH, textAlign: 'left' }}>UTC</th>
                    <th style={TH}>Wind mph</th>
                    <th style={TH}>Dir</th>
                  </tr>
                </thead>
                <tbody>
                  {seaToday.length === 0 ? noData(3) : seaToday.map((s, i) => {
                    const prev = seaSnaps[i + 1] ?? null
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eaecef' }}>
                        <td style={TDL}>{s.label}</td>
                        <td style={TD}>{f1(s.wsc_wind_speed)}&nbsp;<Arrow curr={s.wsc_wind_speed} prev={prev?.wsc_wind_speed ?? null} /></td>
                        <td style={TD}>{s.wsc_wind_dir ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CEFAS Felixstowe buoy */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: '600', color: '#555' }}>
              Felixstowe Buoy (CEFAS)
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f6f8fa', borderBottom: '2px solid #d0d7de' }}>
                    <th style={{ ...TH, textAlign: 'left' }}>UTC</th>
                    <th style={TH}>Wave m</th>
                    <th style={TH}>Sea temp °C</th>
                    <th style={TH}>Wave dir</th>
                  </tr>
                </thead>
                <tbody>
                  {seaToday.length === 0 ? noData(4) : seaToday.map((s, i) => {
                    const prev = seaSnaps[i + 1] ?? null
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eaecef' }}>
                        <td style={TDL}>{s.label}</td>
                        <td style={TD}>{f2(s.cefas_wave_height)}&nbsp;<Arrow curr={s.cefas_wave_height} prev={prev?.cefas_wave_height ?? null} /></td>
                        <td style={TD}>{f1(s.cefas_sea_temp)}</td>
                        <td style={TD}>{s.cefas_wave_dir != null ? `${degToCompass(s.cefas_wave_dir)} ${f0(s.cefas_wave_dir)}°` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Met Office forecast */}
        {latestForecast && (
          <div style={{ marginTop: '1rem', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden', fontSize: '0.875rem' }}>
            {/* Red header */}
            <div style={{ background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: '700' }}>
              {latestForecast.title}
            </div>
            <div style={{ padding: '0.75rem 0.85rem' }}>
              {latestForecast.warning && (
                <p style={{ margin: '0 0 0.75rem', fontStyle: 'italic', color: '#555' }}>
                  {latestForecast.warning}
                </p>
              )}
              {/* 24hr */}
              <p style={{ margin: '0 0 0.5rem', fontWeight: '700', fontSize: '1rem' }}>24 hour forecast:</p>
              <ForecastFields data={latestForecast.forecast} />
              {/* Outlook */}
              <p style={{ margin: '0.75rem 0 0.5rem', fontWeight: '700', fontSize: '1rem' }}>Outlook for the following 24 hours:</p>
              <ForecastFields data={latestForecast.outlook} />
            </div>
          </div>
        )}

        <p style={{ fontSize: '0.72rem', color: '#999', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
          Captured 0700, 1200, 1800 UTC · FTM = Fort Massac station · CEFAS buoy updated every 30 min
        </p>
      </div>

    </main>
  )
}
