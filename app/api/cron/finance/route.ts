import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchMarketData } from '@/lib/finance'

// Map UTC hour → snapshot label
function snapLabel(utcHour: number): string {
  if (utcHour < 9)  return '0700'
  if (utcHour < 15) return '1200'
  return '1800'
}

export async function GET(req: NextRequest) {
  // Vercel sends CRON_SECRET as a Bearer token — reject anything else
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const label = snapLabel(now.getUTCHours())

  // Get UK Bank Rate from config table (updated manually when BOE changes it)
  const { data: cfg } = await supabaseAdmin
    .from('finance_config')
    .select('value')
    .eq('key', 'uk_bank_rate')
    .single()
  const bankRate = cfg ? parseFloat(cfg.value) : null

  // Fetch live market data from Yahoo Finance
  const market = await fetchMarketData()

  // Insert snapshot row
  const { error } = await supabaseAdmin.from('finance_snapshots').insert({
    label,
    gold_usd:  market.gold   != null ? +market.gold.toFixed(2)   : null,
    oil_usd:   market.oil    != null ? +market.oil.toFixed(2)    : null,
    gbp_usd:   market.gbpusd != null ? +market.gbpusd.toFixed(4) : null,
    bank_rate: bankRate,
    ftse:      market.ftse   != null ? +market.ftse.toFixed(2)   : null,
  })

  if (error) {
    console.error('[cron/finance] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cron/finance] ${label} snapshot saved`, market)
  return NextResponse.json({ ok: true, label, captured_at: now.toISOString(), market, bankRate })
}
