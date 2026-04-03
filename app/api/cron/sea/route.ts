import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchFtmassac, fetchWaldringfield, fetchCefas, fetchMetOfficeForecast } from '@/lib/sea'

function snapLabel(utcHour: number): string {
  if (utcHour < 9)  return '0700'
  if (utcHour < 15) return '1200'
  return '1800'
}

const fix1 = (n: number | null) => n != null ? +n.toFixed(1) : null
const fix2 = (n: number | null) => n != null ? +n.toFixed(2) : null

export async function GET(req: NextRequest) {
  // Vercel sends CRON_SECRET as a Bearer token
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const label = snapLabel(now.getUTCHours())

  // Fetch all sources in parallel
  const [ftm, wsc, cefas, forecast] = await Promise.all([
    fetchFtmassac(),
    fetchWaldringfield(),
    fetchCefas(),
    fetchMetOfficeForecast(),
  ])

  const { error } = await supabaseAdmin.from('sea_snapshots').insert({
    label,
    ftm_wind_speed:  fix1(ftm.wind_speed),
    ftm_wind_dir:    fix1(ftm.wind_dir),
    ftm_gust_speed:  fix1(ftm.gust_speed),
    ftm_gust_dir:    fix1(ftm.gust_dir),
    ftm_pressure:    fix1(ftm.pressure),
    ftm_temp:        fix1(ftm.temp),
    ftm_humidity:    fix1(ftm.humidity),
    wsc_wind_speed:  fix1(wsc.wind_speed),
    wsc_wind_dir:    wsc.wind_dir,
    cefas_wave_height: fix2(cefas.wave_height),
    cefas_sea_temp:    fix2(cefas.sea_temp),
    cefas_wave_dir:    fix1(cefas.wave_dir),
    metoffice_forecast: forecast,
  })

  if (error) {
    console.error('[cron/sea] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cron/sea] ${label} snapshot saved`, { ftm, wsc, cefas })
  return NextResponse.json({
    ok: true, label,
    captured_at: now.toISOString(),
    ftm, wsc, cefas,
    forecast_chars: forecast?.length ?? 0,
  })
}
