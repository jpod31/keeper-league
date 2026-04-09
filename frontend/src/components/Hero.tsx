import type { AnalyticsData } from '../types'

const windowColors: Record<string, string> = {
  'Win Now': '#fbbf24', 'Building': '#58a6ff', 'Declining': '#ef4444',
  'Balanced': '#8b949e', 'Dominant & Improving': '#3fb950',
}

export function Hero({ data }: { data: AnalyticsData }) {
  const a = data.analytics
  const n = data.narrative
  const hs = a?.health_score || 0
  const rank = a?.league_context?.avg_sc_rank
  const strokeColor = hs >= 70 ? '#3fb950' : hs >= 45 ? '#fbbf24' : '#ef4444'
  const dashLen = Math.round((hs / 100) * 226)

  return (
    <div className="flex items-center gap-6 p-6 rounded-2xl mb-8" style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d' }}>
      {/* Health ring */}
      <div className="relative w-20 h-20 shrink-0">
        <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="#21262d" strokeWidth="5.5" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={strokeColor} strokeWidth="5.5"
            strokeLinecap="round" strokeDasharray={`${dashLen} 226`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-[#e6edf3]">{Math.round(hs)}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-extrabold text-[#e6edf3] mb-1">{data.team.name}</h1>
        {n?.verdict && <p className="text-sm text-[#c9d1d9] leading-relaxed">{n.verdict}</p>}

        <div className="flex flex-wrap gap-2 mt-3">
          <Chip><b>{Math.round(a?.season_avg || 0)}</b> avg/round</Chip>
          {rank && <Chip><b>{rank.rank}/{rank.of}</b> in league</Chip>}
          <Chip><b>{a?.avg_age || 0}</b> avg age</Chip>
          {a?.window && (
            <span className="text-xs font-bold px-3 py-1 rounded-lg border"
              style={{ color: windowColors[a.window] || '#8b949e', borderColor: windowColors[a.window] || '#30363d' }}>
              {a.window}
            </span>
          )}
          {n?.dependency && (
            <Chip>
              <span style={{ color: n.dependency.level === 'low' ? '#3fb950' : n.dependency.level === 'high' ? '#ef4444' : '#fbbf24' }}>
                {n.dependency.level} dependency
              </span>
            </Chip>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-[#8b949e] px-3 py-1 rounded-lg bg-[#0d1117] border border-[#21262d] [&_b]:text-[#e6edf3]">{children}</span>
}
