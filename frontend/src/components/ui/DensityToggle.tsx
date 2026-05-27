/**
 * DensityToggle — small two-icon toggle for table density.
 *
 * Renders side-by-side comfortable + compact buttons; the active one
 * is highlighted. Mount in the page header or a FilterBar's actions
 * slot. Wire to useDensity for persistence.
 */

import type { Density } from '../../hooks/useDensity'

export interface DensityToggleProps {
  density: Density
  onChange: (d: Density) => void
  className?: string
}

export function DensityToggle({ density, onChange, className }: DensityToggleProps) {
  return (
    <span
      className={['dty', className ?? ''].filter(Boolean).join(' ')}
      role="group"
      aria-label="Row density"
    >
      <button
        type="button"
        className={`dty-btn${density === 'comfortable' ? ' active' : ''}`}
        onClick={() => onChange('comfortable')}
        aria-pressed={density === 'comfortable'}
        title="Comfortable rows"
      >
        <i className="bi bi-arrows-expand" aria-hidden></i>
      </button>
      <button
        type="button"
        className={`dty-btn${density === 'compact' ? ' active' : ''}`}
        onClick={() => onChange('compact')}
        aria-pressed={density === 'compact'}
        title="Compact rows"
      >
        <i className="bi bi-arrows-collapse" aria-hidden></i>
      </button>
    </span>
  )
}
