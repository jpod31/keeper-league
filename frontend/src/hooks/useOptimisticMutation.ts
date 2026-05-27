/**
 * useOptimisticMutation — thin coordinator for optimistic UI updates.
 *
 * The app's existing pattern (see useFieldActions) fires the API, waits
 * for the response, then calls onRefresh() to re-fetch. The UI feels
 * laggy because every action blocks on a roundtrip.
 *
 * This hook flips that:
 *   1. apply(args)   — caller's local state mutation, runs immediately.
 *   2. request(args) — caller's async API call.
 *   3a. On success — onSuccess fires (typically: toast + onRefresh).
 *   3b. On error   — rollback(args) reverts state, then onError fires.
 *
 * The hook itself does NOT own the underlying state — that stays in the
 * component or context. It tracks per-key status so <SavingChip>s can
 * render next to the affected element ("Saving…" → ✓ → fade).
 *
 * Usage:
 *   const opt = useOptimisticMutation<{ pid: number }, Result>({
 *     apply: ({ pid }) => setLocalCaptainId(pid),
 *     rollback: () => setLocalCaptainId(prevId),
 *     request: ({ pid }) => post('/api/set-captain', { player_id: pid }),
 *     onSuccess: () => { toast('Captain updated', 'success'); onRefresh() },
 *     onError:   (e) => toast(e.message, 'error'),
 *   })
 *   <button onClick={() => opt.mutate({ pid }, `cap-${pid}`)}>...</button>
 *   <SavingChip status={opt.statusOf(`cap-${pid}`)} />
 */

import { useCallback, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface OptimisticMutationOptions<Args, Result> {
  apply: (args: Args) => void
  rollback: (args: Args) => void
  request: (args: Args) => Promise<Result>
  onSuccess?: (result: Result, args: Args) => void
  onError?: (error: Error, args: Args) => void
  /** ms to keep status='saved' visible before reverting to 'idle'. Default 1200. */
  savedFadeMs?: number
}

export interface UseOptimisticMutationReturn<Args> {
  /** Trigger the optimistic mutation. `key` is used to scope status (e.g. per-row). */
  mutate: (args: Args, key?: string) => Promise<void>
  /** Look up status for a particular key. Returns 'idle' if unknown. */
  statusOf: (key: string) => SaveStatus
  /** True if any in-flight mutation is pending. */
  anyPending: boolean
}

export function useOptimisticMutation<Args, Result = unknown>({
  apply,
  rollback,
  request,
  onSuccess,
  onError,
  savedFadeMs = 1200,
}: OptimisticMutationOptions<Args, Result>): UseOptimisticMutationReturn<Args> {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({})
  const pendingCount = useRef(0)
  const fadeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const setStatus = useCallback((key: string, status: SaveStatus) => {
    setStatuses(prev => ({ ...prev, [key]: status }))
  }, [])

  const scheduleFade = useCallback((key: string) => {
    if (fadeTimers.current[key]) clearTimeout(fadeTimers.current[key])
    fadeTimers.current[key] = setTimeout(() => {
      setStatus(key, 'idle')
      delete fadeTimers.current[key]
    }, savedFadeMs)
  }, [savedFadeMs, setStatus])

  const mutate = useCallback(async (args: Args, key: string = '_') => {
    apply(args)
    setStatus(key, 'saving')
    pendingCount.current += 1
    try {
      const result = await request(args)
      setStatus(key, 'saved')
      scheduleFade(key)
      onSuccess?.(result, args)
    } catch (err) {
      rollback(args)
      setStatus(key, 'error')
      scheduleFade(key)
      const e = err instanceof Error ? err : new Error(String(err))
      onError?.(e, args)
    } finally {
      pendingCount.current = Math.max(0, pendingCount.current - 1)
    }
  }, [apply, rollback, request, onSuccess, onError, scheduleFade, setStatus])

  const statusOf = useCallback((key: string): SaveStatus => statuses[key] ?? 'idle', [statuses])

  return { mutate, statusOf, anyPending: pendingCount.current > 0 }
}
