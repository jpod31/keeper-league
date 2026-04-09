import { useLocation } from 'react-router'

export function PlaceholderPage({ title }: { title?: string }) {
  const location = useLocation()
  const pageName = title || location.pathname.split('/').pop() || 'Page'

  return (
    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
      <div className="empty-icon" style={{ width: 64, height: 64 }}>
        <i className="bi bi-tools" style={{ fontSize: '1.5rem' }}></i>
      </div>
      <h4 className="text-capitalize">{pageName}</h4>
      <p>This page is being migrated to the new experience.</p>
    </div>
  )
}
