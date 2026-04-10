import { useState, useEffect } from 'react'
import { api, post } from '../../lib/api'

interface SSPPlayer {
  id: number; name: string; position: string; afl_team: string; sc_avg: number
}

interface Props {
  leagueId: string; teamId: string; ltilId: number
  onClose: () => void; onSuccess: () => void
}

export function SSPModal({ leagueId, teamId, ltilId, onClose, onSuccess }: Props) {
  const [players, setPlayers] = useState<SSPPlayer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    api<SSPPlayer[]>(`/leagues/${leagueId}/team/${teamId}/api/ssp-available`)
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leagueId, teamId])

  const filtered = search
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : players

  const handlePick = async (replacementId: number) => {
    setPicking(true)
    try {
      const data = await post<{ error?: string }>(`/leagues/${leagueId}/team/${teamId}/api/ssp-pick`, {
        ltil_id: ltilId, replacement_player_id: replacementId,
      })
      if (!data.error) { onSuccess(); onClose() }
    } catch {}
    setPicking(false)
  }

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show d-block" tabIndex={-1} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
          <div className="modal-content" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #30363d', padding: '.75rem 1rem' }}>
              <h6 className="modal-title fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-bandaid me-1" style={{ color: '#f85149' }}></i>SSP — Select Replacement
              </h6>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              <input type="text" className="form-control form-control-sm mb-3" placeholder="Search players..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }} />
              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                {loading && <div className="text-center text-secondary py-3" style={{ fontSize: '.8rem' }}>Loading players...</div>}
                {!loading && filtered.length === 0 && <div className="text-center text-secondary py-3" style={{ fontSize: '.8rem' }}>No available players</div>}
                {filtered.map(p => (
                  <div key={p.id} className="ssp-player-row">
                    <div className="ssp-player-info">
                      <span className="ssp-player-name">{p.name}</span>
                      <span className="ssp-player-meta">{p.afl_team || ''} &bull; {p.position || '-'} &bull; AVG {p.sc_avg ? Math.round(p.sc_avg) : '-'}</span>
                    </div>
                    <button className="btn btn-sm btn-outline-danger" disabled={picking}
                      onClick={() => handlePick(p.id)} style={{ fontSize: '.7rem', padding: '2px 10px' }}>
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
