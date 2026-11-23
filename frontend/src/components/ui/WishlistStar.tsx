/**
 * WishlistStar — the canonical "pin this player" star button.
 *
 * Renders a Bootstrap-icon star (outline when unpinned, filled-gold
 * when pinned). Wires straight into useWishlist via the playerId.
 * Use as the leading cell in player tables / lists across the app.
 *
 * Wrapped in a 30px-wide td-friendly button to match the size
 * pattern established in PlayerPoolPage / InjuriesPage. Keep the
 * 30px column width in the parent table.
 */

import type { CSSProperties } from 'react'
import { useWishlist } from '../../hooks/useWishlist'

export interface WishlistStarProps {
  /** From useWishlist(leagueId). Passed in so the parent decides scope. */
  wishlist: ReturnType<typeof useWishlist>
  playerId: number
  playerName: string
  /** Style overrides (e.g. larger size for detailed rows). */
  size?: 'sm' | 'md'
  className?: string
  style?: CSSProperties
}

export function WishlistStar({
  wishlist,
  playerId,
  playerName,
  size = 'sm',
  className,
  style,
}: WishlistStarProps) {
  const pinned = wishlist.isWishlisted(playerId)
  const fontSize = size === 'md' ? '1rem' : '.85rem'
  return (
    <button
      type="button"
      onClick={() => wishlist.toggle(playerId)}
      title={pinned ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-label={pinned ? `Remove ${playerName} from wishlist` : `Add ${playerName} to wishlist`}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        padding: 4,
        cursor: 'pointer',
        color: pinned ? '#d29922' : 'var(--kl-text-faint)',
        fontSize,
        lineHeight: 1,
        ...style,
      }}
    >
      <i className={`bi ${pinned ? 'bi-star-fill' : 'bi-star'}`}></i>
    </button>
  )
}
