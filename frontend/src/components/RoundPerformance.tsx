import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface Round {
  round: number
  score: number
}

export function RoundPerformance({ rounds }: { rounds: Round[] }) {
  const filtered = rounds.filter(r => r.round > 0 && r.score > 0)
  if (filtered.length < 2) return null

  const avg = filtered.reduce((s, r) => s + r.score, 0) / filtered.length
  const max = Math.max(...filtered.map(r => r.score))
  const min = Math.min(...filtered.map(r => r.score))

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <MiniStat label="Season Avg" value={Math.round(avg).toLocaleString()} />
        <MiniStat label="Best" value={Math.round(max).toLocaleString()} color="#3fb950" />
        <MiniStat label="Worst" value={Math.round(min).toLocaleString()} color="#ef4444" />
      </div>

      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={filtered} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="round"
              tickFormatter={v => `R${v}`}
              tick={{ fill: '#484f58', fontSize: 10 }}
              axisLine={{ stroke: '#21262d' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#484f58', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }}
              labelFormatter={v => `Round ${v}`}
              formatter={(v) => [String(v), 'Score']}
              cursor={{ fill: '#21262d40' }}
            />
            <ReferenceLine y={avg} stroke="#58a6ff" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {filtered.map((r, i) => (
                <Cell key={i} fill={r.score >= avg ? '#3fb95088' : '#ef444488'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-[#0d1117] border border-[#21262d]">
      <p className="text-[10px] text-[#484f58]">{label}</p>
      <p className="text-sm font-black" style={{ color: color || '#e6edf3' }}>{value}</p>
    </div>
  )
}
