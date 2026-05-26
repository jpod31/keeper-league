import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface LeagueSummary {
  id: number
  name: string
  season_year: number
  invite_code: string
  team_count: number
  user_team: { id: number; name: string } | null
  is_commissioner: boolean
}

// Stable accent palette so each league card gets a distinctive theme.
const PALETTE = [
  { hex: '#58a6ff', rgb: '88,166,255' },
  { hex: '#ffb471', rgb: '255,180,113' },
  { hex: '#bc8cff', rgb: '188,140,255' },
  { hex: '#3fb950', rgb: '63,185,80' },
  { hex: '#e3b341', rgb: '227,179,65' },
  { hex: '#ff7b72', rgb: '255,123,114' },
]

function initial(name: string): string {
  return (name?.[0] || '·').toUpperCase()
}

export function LeagueListPage() {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<LeagueSummary[]>('/api/leagues').then(setLeagues).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && leagues.length === 1) {
      navigate(`/leagues/${leagues[0].id}`, { replace: true })
    }
  }, [loading, leagues, navigate])

  if (loading) return <Spinner text="Loading..." />
  if (leagues.length === 1) return <Spinner text="Loading league..." />

  if (leagues.length === 0) {
    return (
      <div className="lg-page">
        <div className="lg-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{
            width: 96, height: 96, margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(88,166,255,.2), rgba(88,166,255,.04))',
            border: '1px solid rgba(88,166,255,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.4rem', color: '#79c0ff',
          }}>
            <i className="bi bi-trophy"></i>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--pp-text-strong)', marginBottom: 8 }}>
            Welcome to Keeper League
          </h2>
          <p style={{ fontSize: '.95rem', color: 'var(--pp-text-muted)', maxWidth: 460, margin: '0 auto 24px' }}>
            Create your first league to start drafting, trading, and competing with your mates in AFL fantasy.
          </p>
          <Link to="/leagues/create" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '.92rem' }}>
            <i className="bi bi-plus-lg me-2"></i>Create your first league
          </Link>
        </div>
      </div>
    )
  }

  // Aggregate stats across leagues — a personal banner like a sports profile
  const totalLeagues = leagues.length
  const teamsCount = leagues.filter(l => l.user_team).length
  const commishCount = leagues.filter(l => l.is_commissioner).length

  return (
    <div className="lg-page">
      {/* Personal stats banner */}
      <section style={{
        marginBottom: 24,
        padding: '20px 24px',
        borderRadius: 16,
        background:
          'radial-gradient(120% 200% at 100% 0%, rgba(88,166,255,.18), transparent 55%),' +
          ' linear-gradient(180deg, var(--pp-surface-1), var(--pp-surface-0))',
        border: '1px solid var(--pp-surface-edge)',
        boxShadow: '0 24px 56px -22px rgba(0,0,0,.55)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em',
                          color: 'var(--pp-text-muted)' }}>Home</div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: 'var(--pp-text-strong)',
                         margin: 0, lineHeight: 1.05 }}>Your leagues</h1>
            <div style={{ fontSize: '.85rem', color: 'var(--pp-text-muted)', marginTop: 4 }}>
              Pick a league to jump into the action.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Stat value={totalLeagues} label="Leagues" colour="#79c0ff" />
            <Stat value={teamsCount} label="Teams" colour="#7ee787" />
            <Stat value={commishCount} label="Commish of" colour="#d29922" />
          </div>
        </div>
      </section>

      {/* Lobby grid */}
      <div className="lg-lobby-grid">
        {leagues.map((lg, i) => {
          const accent = PALETTE[i % PALETTE.length]
          return (
            <Link key={lg.id} to={`/leagues/${lg.id}`} className="lg-lobby-card"
              style={{ '--lg-card-rgb': accent.rgb } as React.CSSProperties}>
              <div className="lg-lobby-card-head">
                <div className="lg-lobby-card-logo">{initial(lg.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lg-lobby-card-name">{lg.name}</div>
                  <div className="lg-lobby-card-sub">
                    {lg.season_year} season
                    {lg.is_commissioner && <span style={{ marginLeft: 8, color: '#d29922' }}><i className="bi bi-shield-check"></i> Commish</span>}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '.85rem', color: 'var(--pp-text)', marginBottom: 4 }}>
                {lg.user_team ? (
                  <>Your team: <b style={{ color: 'var(--pp-text-strong)' }}>{lg.user_team.name}</b></>
                ) : (
                  <span style={{ color: '#f0d18a' }}><i className="bi bi-info-circle me-1"></i>You haven't joined yet</span>
                )}
              </div>

              <div className="lg-lobby-card-stats">
                <div className="lg-lobby-card-stat">
                  <div className="lg-lobby-card-stat-value">{lg.team_count}</div>
                  <div className="lg-lobby-card-stat-label">Teams</div>
                </div>
                <div className="lg-lobby-card-stat">
                  <div className="lg-lobby-card-stat-value">{lg.user_team ? 'Y' : '—'}</div>
                  <div className="lg-lobby-card-stat-label">Joined</div>
                </div>
                <div className="lg-lobby-card-stat">
                  <div className="lg-lobby-card-stat-value">{lg.is_commissioner ? 'C' : '—'}</div>
                  <div className="lg-lobby-card-stat-label">Role</div>
                </div>
              </div>

              <div className="lg-lobby-card-cta">
                <span>Open dashboard</span>
                <i className="bi bi-arrow-right"></i>
              </div>
            </Link>
          )
        })}

        {/* Create new league CTA card */}
        <Link to="/leagues/create" className="lg-lobby-card"
          style={{
            background: 'linear-gradient(180deg, rgba(63,185,80,.04), var(--pp-surface-0))',
            border: '1px dashed rgba(63,185,80,.4)',
            justifyContent: 'center', alignItems: 'center',
            textAlign: 'center',
          }}>
          <div style={{
            width: 56, height: 56, marginBottom: 12,
            borderRadius: 14,
            background: 'rgba(63,185,80,.12)',
            border: '1px solid rgba(63,185,80,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', color: '#7ee787',
          }}>
            <i className="bi bi-plus-lg"></i>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--pp-text-strong)' }}>Create a league</div>
          <div style={{ fontSize: '.72rem', color: 'var(--pp-text-muted)', marginTop: 4 }}>Start one with your mates</div>
        </Link>
      </div>
    </div>
  )
}

function Stat({ value, label, colour }: { value: number; label: string; colour: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 64 }}>
      <div style={{
        fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800,
        color: colour, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.14em', color: 'var(--pp-text-muted)', marginTop: 4,
      }}>{label}</div>
    </div>
  )
}
