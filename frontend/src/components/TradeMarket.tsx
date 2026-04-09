import { useState } from 'react'
import type { TradeTable, TradeTarget } from '../types'

type Tab = 'gaps' | 'targets' | 'free_agents' | 'surplus'

const tagColors: Record<string, string> = {
  Elite: '#3fb950', 'Elite Veteran': '#3fb950', Premium: '#58a6ff',
  'Emerging Star': '#a371f7', Breakout: '#a371f7', Proven: '#8b949e',
  Steady: '#8b949e', Developing: '#fbbf24', Project: '#fbbf24',
  Declining: '#ef4444', Veteran: '#ef4444', Fringe: '#484f58',
}

export function TradeMarket({ table }: { table: TradeTable }) {
  const [tab, setTab] = useState<Tab>('gaps')

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'gaps', label: 'Gaps', count: table.gaps?.length || 0 },
    { key: 'targets', label: 'Trade Targets', count: table.trade_targets?.length || 0 },
    { key: 'free_agents', label: 'Free Agents', count: table.free_agents?.length || 0 },
    { key: 'surplus', label: 'Your Surplus', count: table.surplus?.length || 0 },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[#0d1117] border border-[#21262d] w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
              tab === t.key ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#484f58] hover:text-[#8b949e]'
            }`}>
            {t.label} {t.count > 0 && <span className="ml-1 text-[10px] opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'gaps' && <GapsView gaps={table.gaps || []} />}
      {tab === 'targets' && <PlayerList players={table.trade_targets || []} showOwner />}
      {tab === 'free_agents' && <PlayerList players={table.free_agents || []} />}
      {tab === 'surplus' && <PlayerList players={table.surplus || []} showReason />}
    </div>
  )
}

function GapsView({ gaps }: { gaps: TradeTable['gaps'] }) {
  if (!gaps.length) return <Empty />
  return (
    <div className="space-y-2">
      {gaps.map((g, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#0d1117] border border-[#21262d]">
          <span className="text-sm font-black text-[#e6edf3] w-10">{g.position}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-[#8b949e]">Your avg <b className="text-[#e6edf3]">{g.avg_sc.toFixed(1)}</b></span>
              <span className="text-xs text-[#484f58]">vs</span>
              <span className="text-xs text-[#8b949e]">League <b className="text-[#e6edf3]">{g.league_avg.toFixed(1)}</b></span>
            </div>
            <p className="text-[10px] text-[#484f58]">
              Weakest: <span className="text-[#ef4444]">{g.weakest_player}</span> ({g.weakest_sc.toFixed(0)})
            </p>
          </div>
          <span className="text-sm font-bold text-[#ef4444]">-{Math.abs(g.gap).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

function PlayerList({ players, showOwner, showReason }: { players: TradeTarget[]; showOwner?: boolean; showReason?: boolean }) {
  if (!players.length) return <Empty />
  return (
    <div className="space-y-1">
      {players.map((p, i) => {
        const tc = tagColors[p.tag] || '#8b949e'
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] hover:bg-[#161b22] transition">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#e6edf3]">{p.name}</span>
                <span className="text-[10px] text-[#484f58]">{p.position}</span>
                {p.fills_gap && <span className="text-[10px] font-bold text-[#3fb950]">FILLS GAP</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ color: tc, borderColor: tc + '40' }}>{p.tag}</span>
                <span className="text-[10px] text-[#484f58]">Age {p.age}</span>
                {showOwner && p.owner && <span className="text-[10px] text-[#484f58]">{p.owner}</span>}
                {showReason && p.reason && <span className="text-[10px] text-[#fbbf24]">{p.reason}</span>}
              </div>
            </div>
            <span className="text-sm font-black text-[#e6edf3] tabular-nums">{p.sc_avg.toFixed(0)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Empty() {
  return <p className="text-xs text-[#484f58] py-4 text-center">No data available</p>
}
