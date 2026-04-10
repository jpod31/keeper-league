import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string }

interface Final {
  id: number
  final_type: string
  status: string
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
}

interface FinalsData {
  league: { id: number; name: string; season_year: number }
  is_commissioner: boolean
  finals: Final[]
}

function FinalCard({ f, highlight, hideStatusPill, label }: { f: Final; highlight?: boolean; hideStatusPill?: boolean; label?: string }) {
  const homeWon = f.status === 'completed' && (f.home_score || 0) > (f.away_score || 0)
  const awayWon = f.status === 'completed' && (f.away_score || 0) > (f.home_score || 0)
  return (
    <div
      className="fixture-card mb-3"
      style={highlight ? { borderColor: '#FFD700', borderWidth: 2, boxShadow: '0 0 12px rgba(255,215,0,.15)' } : undefined}
    >
      <div className="p-3">
        <div
          className="d-flex justify-content-between align-items-center"
          style={{ fontSize: '.7rem', color: highlight ? '#FFD700' : '#484f58', marginBottom: '.5rem' }}
        >
          <span>{label || (f.final_type === 'GF' ? 'Grand Final' : f.final_type)}</span>
          {!hideStatusPill && f.status === 'completed' && (
            <span className="status-pill status-completed" style={{ fontSize: '.6rem' }}>Final</span>
          )}
        </div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fixture-team" style={{ fontSize: '.85rem' }}>{f.home_team?.name}</span>
          <span
            className="fw-bold"
            style={homeWon ? { color: '#3fb950', fontSize: highlight ? '1.1rem' : undefined }
              : f.status === 'completed' && awayWon ? { color: '#6e7681' }
              : undefined}
          >
            {f.status === 'completed' ? Math.round(f.home_score || 0) : '-'}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <span className="fixture-team" style={{ fontSize: '.85rem' }}>{f.away_team?.name}</span>
          <span
            className="fw-bold"
            style={awayWon ? { color: '#3fb950', fontSize: highlight ? '1.1rem' : undefined }
              : f.status === 'completed' && homeWon ? { color: '#6e7681' }
              : undefined}
          >
            {f.status === 'completed' ? Math.round(f.away_score || 0) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function FinalsPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<FinalsData>(`/leagues/${leagueId}/finals?format=json`)

  if (loading) return <Spinner text="Loading finals..." />
  if (!data) return <p className="text-danger">Failed to load finals</p>

  const { league, is_commissioner, finals } = data
  const qfs = finals.filter(f => f.final_type === 'QF1' || f.final_type === 'QF2')
  const pfs = finals.filter(f => f.final_type === 'PF')
  const gfs = finals.filter(f => f.final_type === 'GF')

  async function generate() {
    if (!confirm('Generate finals from current standings?')) return
    await fetch(`/leagues/${leagueId}/finals/generate`, { method: 'POST', credentials: 'include', redirect: 'manual' })
    refetch()
  }

  return (
    <div>
      <LeagueSubnav active="fixture" leagueId={leagueId!} />

      <div className="page-header" style={{ marginTop: 0 }}>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Finals Series</h2>
            <span style={{ fontSize: '.78rem', color: '#8b949e' }}>{league.season_year} finals bracket</span>
          </div>
          {is_commissioner && finals.length === 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={generate}>
              <i className="bi bi-trophy me-1"></i>Generate Finals
            </button>
          )}
        </div>
      </div>

      {finals.length > 0 ? (
        <div className="row g-4">
          <div className="col-md-4">
            <h5 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Qualifying Finals
            </h5>
            {qfs.map(f => <FinalCard key={f.id} f={f} />)}
          </div>
          <div className="col-md-4">
            <h5 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Preliminary Final
            </h5>
            {pfs.map(f => <FinalCard key={f.id} f={f} hideStatusPill label="Loser QF1 vs Winner QF2" />)}
          </div>
          <div className="col-md-4">
            <h5 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Grand Final
            </h5>
            {gfs.map(f => <FinalCard key={f.id} f={f} highlight />)}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><i className="bi bi-trophy" style={{ fontSize: '1.5rem' }}></i></div>
          <h4>No finals generated</h4>
          <p>Complete the regular season and generate finals from the standings.</p>
        </div>
      )}
    </div>
  )
}
