import { useLocation } from 'react-router'
import { Construction } from 'lucide-react'

export function PlaceholderPage({ title }: { title?: string }) {
  const location = useLocation()
  const pageName = title || location.pathname.split('/').pop() || 'Page'

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <Construction className="w-10 h-10 text-[#21262d]" />
      <div className="text-center">
        <p className="text-lg font-bold text-[#e6edf3] capitalize">{pageName}</p>
        <p className="text-sm text-[#484f58] mt-1">This page is being migrated to the new experience.</p>
      </div>
    </div>
  )
}
