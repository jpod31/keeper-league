import { useParams } from 'react-router'

interface Props {
  title: string
  description: string
  path: string   // e.g. "/leagues/${leagueId}/keepers"
  icon?: string
}

/**
 * Lightweight landing card for legacy Jinja-rendered pages that haven't
 * been fully ported to React yet. Opens the full page via a direct link
 * rather than iframing — avoids double-chrome while keeping SPA navigation.
 */
export function LegacyPage({ title, description, path, icon = 'bi-clock-history' }: Props) {
  const { leagueId } = useParams()
  const href = path.replace(':leagueId', leagueId || '')

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card" style={{ marginTop: '3rem' }}>
          <div className="card-body text-center py-5 px-4">
            <div
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'rgba(88,166,255,.1)', color: '#58a6ff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', marginBottom: 16,
              }}
            >
              <i className={`bi ${icon}`}></i>
            </div>
            <h4 className="fw-bold mb-2" style={{ color: 'var(--kl-text-heading)', fontSize: '1.1rem' }}>
              {title}
            </h4>
            <p className="text-secondary mb-4" style={{ fontSize: '.85rem' }}>
              {description}
            </p>
            <a href={href} className="btn btn-primary">
              <i className="bi bi-box-arrow-up-right me-1"></i>Open {title}
            </a>
            <div className="text-secondary mt-3" style={{ fontSize: '.7rem' }}>
              Opens the full legacy view in this tab
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
