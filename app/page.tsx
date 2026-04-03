import { supabase } from '@/lib/supabase'

export const revalidate = 0  // Always fetch fresh — data changes 3x/day

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

// Direction arrow comparing current vs previous value (>0.01% threshold)
function Arrow({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || prev == null) return <span style={{ color: '#aaa' }}>–</span>
  const pct = (curr - prev) / prev
  if (pct >  0.0001) return <span style={{ color: '#1a7f37', fontWeight: 'bold' }}>↑</span>
  if (pct < -0.0001) return <span style={{ color: '#cf222e', fontWeight: 'bold' }}>↓</span>
  return <span style={{ color: '#888' }}>→</span>
}

const f2 = (n: number | null) =>
  n != null ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
const f4 = (n: number | null) =>
  n != null ? n.toFixed(4) : '—'
const f0 = (n: number | null) =>
  n != null ? n.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—'

// Gold in GBP = Gold USD / GBP-USD rate
const goldGbp = (s: Snap) =>
  s.gold_usd != null && s.gbp_usd != null && s.gbp_usd > 0
    ? s.gold_usd / s.gbp_usd
    : null

export default async function Page() {
  // Fetch last 9 rows — enough for today's 3 + yesterday's 3 for comparison
  const { data, error } = await supabase
    .from('finance_snapshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(9)

  if (error) {
    return <p style={{ padding: '1rem', color: '#cf222e' }}>Error loading data: {error.message}</p>
  }

  const snaps = (data ?? []) as Snap[]
  const today = snaps.slice(0, 3)  // Most recent 3 snapshots

  const lastSnap = snaps[0]
  const lastTime = lastSnap
    ? new Date(lastSnap.captured_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC',
      }) + ' UTC'
    : null

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

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', maxWidth: '820px', margin: '0 auto' }}>
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
            {today.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                  No snapshots yet today — first capture at 0700 UTC
                </td>
              </tr>
            ) : (
              today.map((s, i) => {
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
              })
            )}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '0.72rem', color: '#999', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
        ↑↓ vs previous snapshot · Captured 0700, 1200, 1800 UTC · FTSE shown at last traded price
        {lastTime ? <> · Last update: {lastTime}</> : null}
      </p>
    </main>
  )
}
