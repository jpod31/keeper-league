/**
 * useWishlist — pin/star players across the app.
 *
 * Fetches the set of wishlisted player IDs for the current user +
 * league on mount, then exposes a `toggle(playerId)` that hits
 * /leagues/<id>/wishlist/toggle with optimistic local update and
 * rollback on error. Built on useOptimisticMutation so the same
 * status semantics apply (saving/saved/error per playerId).
 *
 * PlayerPoolPage has its own copy of this logic (predates the hook);
 * worth migrating in a follow-up to unify.
 */

import { useEffect, useState } from 'react'
import { useOptimisticMutation } from './useOptimisticMutation'

export interface UseWishlistReturn {
  ids: Set<number>
  isWishlisted: (playerId: number) => boolean
  toggle: (playerId: number) => void
  statusOf: (playerId: number) => 'idle' | 'saving' | 'saved' | 'error'
}

export function useWishlist(leagueId: string | number | undefined): UseWishlistReturn {
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!leagueId) return
    fetch(`/leagues/${leagueId}/wishlist/api`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setIds(new Set<number>(d.player_ids || [])))
      .catch(() => {
        // Silent — wishlist absence is non-fatal; star renders as "not wishlisted".
      })
  }, [leagueId])

  const mutation = useOptimisticMutation<{ playerId: number; wasPinned: boolean }, { wishlisted: boolean }>({
    apply: ({ playerId, wasPinned }) => {
      setIds(prev => {
        const next = new Set(prev)
        if (wasPinned) next.delete(playerId)
        else next.add(playerId)
        return next
      })
    },
    rollback: ({ playerId, wasPinned }) => {
      // Inverse of apply — restore pre-toggle state.
      setIds(prev => {
        const next = new Set(prev)
        if (wasPinned) next.add(playerId)
        else next.delete(playerId)
        return next
      })
    },
    request: async ({ playerId }) => {
      const res = await fetch(`/leagues/${leagueId}/wishlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Wishlist toggle failed (${res.status})`)
      return res.json() as Promise<{ wishlisted: boolean }>
    },
    onSuccess: (result, { playerId }) => {
      // Server is the source of truth — reconcile in case the optimistic
      // direction didn't match (rare; e.g. concurrent toggle from another tab).
      setIds(prev => {
        const next = new Set(prev)
        if (result.wishlisted) next.add(playerId)
        else next.delete(playerId)
        return next
      })
    },
  })

  return {
    ids,
    isWishlisted: (playerId: number) => ids.has(playerId),
    toggle: (playerId: number) => mutation.mutate(
      { playerId, wasPinned: ids.has(playerId) },
      `wishlist-${playerId}`,
    ),
    statusOf: (playerId: number) => mutation.statusOf(`wishlist-${playerId}`),
  }
}
