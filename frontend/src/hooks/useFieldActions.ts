import { useState, useCallback } from 'react'
import { post, api } from '../lib/api'

interface PlayerDetail {
  id: number; name: string; position: string; afl_team: string
  age: number; height_cm: number; career_games: number
  sc_avg: number; sc_avg_prev: number; rating: number; potential: number
  injury_type: string | null; injury_severity: string | null; injury_return: string | null
  round_scores: { round: number; sc: number }[]
  last_game: Record<string, number> | null
  season_avg: Record<string, number> | null
  season_games: number
}

export type ActionMode = 'swap' | 'emg_replace' | '7s_replace' | null

export interface SwapSourceInfo {
  pid: number
  section: string      // 'field' | 'flex' | 'reserve'
  positions: string[]  // ['DEF'] or ['MID','FWD']
  fieldPos: string     // 'DEF' | 'MID' | etc. or '' for flex/reserve
}

/** Check if two players can swap positions */
export function checkSwapEligible(
  src: SwapSourceInfo,
  tgtSection: string, tgtPositions: string[], tgtFieldPos: string,
): boolean {
  // Don't offer to swap two on-field players in the same zone — pointless, both already playing
  if (src.section === 'field' && tgtSection === 'field' && src.fieldPos === tgtFieldPos) return false

  function canFillSlot(playerPositions: string[], slotSection: string, slotFieldPos: string) {
    if (slotSection === 'flex' || slotSection === 'reserve') return true
    return playerPositions.includes(slotFieldPos)
  }
  return canFillSlot(src.positions, tgtSection, tgtFieldPos)
      && canFillSlot(tgtPositions, src.section, src.fieldPos)
}

export function useFieldActions(
  leagueId: string, teamId: string, onRefresh: () => void,
  ageCutoff = 24, maxSenior7s = 2,
) {
  const API = `/leagues/${leagueId}/team/${teamId}/api`
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null)
  const [swapSource, setSwapSource] = useState<SwapSourceInfo | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [playerModal, setPlayerModal] = useState<PlayerDetail | null>(null)

  const toast = useCallback((text: string, type = 'info') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 2500)
  }, [])

  const fvApi = useCallback(async (endpoint: string, body: Record<string, unknown>) => {
    try {
      const data = await post<{ error?: string }>(API + endpoint, body)
      if (data.error) toast(data.error, 'error')
      return data
    } catch {
      toast('Request failed', 'error')
      return { error: true }
    }
  }, [API, toast])

  const setCaptain = useCallback(async (pid: number) => {
    // Fire API, then silently refresh in background — no flash
    fvApi('/set-captain', { player_id: pid }).then(data => {
      if (!data.error) { toast('Captain updated', 'success'); onRefresh() }
    })
  }, [fvApi, toast, onRefresh])

  const setVC = useCallback(async (pid: number) => {
    fvApi('/set-vc', { player_id: pid }).then(data => {
      if (!data.error) { toast('Vice Captain updated', 'success'); onRefresh() }
    })
  }, [fvApi, toast, onRefresh])

  const set7sCaptain = useCallback(async (pid: number) => {
    const data = await fvApi('/set-7s-captain', { player_id: pid })
    if (!data.error) { toast('7s Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const addToLTIL = useCallback(async (pid: number) => {
    const data = await fvApi('/add-to-ltil', { player_id: pid })
    if (!data.error) { toast('Added to LTIL', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const removeFromLTIL = useCallback(async (pid: number) => {
    if (!confirm('Remove this player from the LTIL? They return to your active squad.')) return
    const data = await fvApi('/remove-from-ltil', { player_id: pid })
    if (!data.error) { toast('Player removed from LTIL', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const cancelAllModes = useCallback(() => {
    setSwapSource(null)
    setActionMode(null)
  }, [])

  // ── Swap: start ──
  const startSwap = useCallback((pid: number, section: string, positions: string[], fieldPos: string) => {
    if (swapSource?.pid === pid) { cancelAllModes(); return }
    setSwapSource({ pid, section, positions, fieldPos })
    setActionMode('swap')
    // Tactile handshake on mobile — without this, tapping "Swap" in the
    // action sheet just closes it silently and reads as "nothing happened".
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }
  }, [swapSource, cancelAllModes])

  // ── Swap: complete with animation ──
  const completeSwap = useCallback((targetPid: number) => {
    if (!swapSource || swapSource.pid === targetPid) return
    const savedSource = swapSource.pid
    cancelAllModes()

    const sourceEl = document.querySelector(`.fv-card[data-player-id="${savedSource}"], .mob-pos-row[data-player-id="${savedSource}"]`) as HTMLElement
    const targetEl = document.querySelector(`.fv-card[data-player-id="${targetPid}"], .mob-pos-row[data-player-id="${targetPid}"]`) as HTMLElement

    if (!sourceEl || !targetEl) {
      fvApi('/swap', { player_id_1: savedSource, player_id_2: targetPid }).then(data => {
        if (!data.error) { toast('Players swapped', 'success'); onRefresh() }
      })
      return
    }

    const srcRect = sourceEl.getBoundingClientRect()
    const tgtRect = targetEl.getBoundingClientRect()
    const dx = tgtRect.left - srcRect.left
    const dy = tgtRect.top - srcRect.top

    sourceEl.style.zIndex = '10'
    targetEl.style.zIndex = '10'
    sourceEl.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
    targetEl.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
    sourceEl.style.transform = `translate(${dx}px, ${dy}px)`
    targetEl.style.transform = `translate(${-dx}px, ${-dy}px)`

    const apiPromise = fvApi('/swap', { player_id_1: savedSource, player_id_2: targetPid })
    const animDone = new Promise<void>(r => setTimeout(r, 370))

    Promise.all([apiPromise, animDone]).then(([data]) => {
      ;[sourceEl, targetEl].forEach(el => {
        el.style.transform = ''
        el.style.transition = ''
        el.style.zIndex = ''
      })
      if (data && !data.error) { toast('Players swapped', 'success'); onRefresh() }
    })
  }, [swapSource, fvApi, toast, onRefresh, cancelAllModes])

  // ── Emergency: with replacement mode ──
  const toggleEmergency = useCallback((pid: number, emgIds: number[], lockedPids: Set<number>) => {
    if (swapSource?.pid === pid && actionMode === 'emg_replace') { cancelAllModes(); return }
    cancelAllModes()

    const isEmg = emgIds.includes(pid)
    if (isEmg) {
      fvApi('/set-emergency', { player_id: pid }).then(d => {
        if (d.error) toast(typeof d.error === 'string' ? d.error : 'Could not update emergency', 'error')
        else onRefresh()
      })
    } else if (emgIds.filter(id => !lockedPids.has(id)).length < 4) {
      // Room available (counting only unlocked slots)
      fvApi('/set-emergency', { player_id: pid }).then(d => {
        if (d.error) toast(typeof d.error === 'string' ? d.error : 'Could not update emergency', 'error')
        else onRefresh()
      })
    } else {
      // Full — enter replacement mode
      setSwapSource({ pid, section: 'reserve', positions: [], fieldPos: '' })
      setActionMode('emg_replace')
      toast('Emergency slots full — select one to replace', 'info')
    }
  }, [swapSource, actionMode, fvApi, onRefresh, toast, cancelAllModes])

  // ── Emergency: complete replacement ──
  const completeEmgReplace = useCallback((targetPid: number) => {
    if (!swapSource) return
    const sourcePid = swapSource.pid
    cancelAllModes()
    fvApi('/set-emergency', { player_id: targetPid }).then(d1 => {
      if (d1.error) return
      fvApi('/set-emergency', { player_id: sourcePid }).then(() => onRefresh())
    })
  }, [swapSource, fvApi, onRefresh, cancelAllModes])

  // ── 7s: with replacement mode + age cutoff ──
  const toggle7s = useCallback((pid: number, sevensIds: number[], playerAge: number, _lockedPids: Set<number>) => {
    if (swapSource?.pid === pid && actionMode === '7s_replace') { cancelAllModes(); return }
    cancelAllModes()

    const is7s = sevensIds.includes(pid)
    if (is7s) {
      fvApi('/toggle-7s', { player_id: pid }).then(d => {
        if (d.error) toast(typeof d.error === 'string' ? d.error : 'Could not update 7s', 'error')
        else onRefresh()
      })
      return
    }

    // Count seniors currently in 7s
    // We need ages from DOM data attributes
    let seniorCount = 0
    sevensIds.forEach(sid => {
      const el = document.querySelector(`[data-player-id="${sid}"]`) as HTMLElement
      if (el) {
        const age = parseInt(el.dataset.age || '0')
        if (age >= ageCutoff) seniorCount++
      }
    })

    const playerIsSenior = playerAge >= ageCutoff

    if (sevensIds.length < 7) {
      if (playerIsSenior && seniorCount >= maxSenior7s) {
        toast(`Max ${maxSenior7s} senior (${ageCutoff}+) players in 7s`, 'error')
        return
      }
      fvApi('/toggle-7s', { player_id: pid }).then(d => { if (!d.error) onRefresh() })
    } else {
      // Full — enter replacement mode
      setSwapSource({ pid, section: 'reserve', positions: [], fieldPos: '' })
      setActionMode('7s_replace')
      toast('7s squad full — select one to replace', 'info')
    }
  }, [swapSource, actionMode, fvApi, onRefresh, toast, cancelAllModes, ageCutoff, maxSenior7s])

  // ── 7s: complete replacement ──
  const complete7sReplace = useCallback((targetPid: number) => {
    if (!swapSource) return
    const sourcePid = swapSource.pid
    cancelAllModes()
    fvApi('/toggle-7s', { player_id: targetPid }).then(d1 => {
      if (d1.error) return
      fvApi('/toggle-7s', { player_id: sourcePid }).then(() => onRefresh())
    })
  }, [swapSource, fvApi, onRefresh, cancelAllModes])

  // ── Handle click on any player during a mode ──
  const handlePlayerClick = useCallback((pid: number, section: string, positions: string[], fieldPos: string, isLocked: boolean, isEmg: boolean, is7s: boolean) => {
    if (!swapSource) return false // No mode active
    if (swapSource.pid === pid) return false // Clicked source, ignore (cancel handled elsewhere)
    if (isLocked) return false

    if (actionMode === 'swap') {
      // Check eligibility
      if (checkSwapEligible(swapSource, section, positions, fieldPos)) {
        completeSwap(pid)
        return true
      }
      return false
    }
    if (actionMode === 'emg_replace' && isEmg) {
      completeEmgReplace(pid)
      return true
    }
    if (actionMode === '7s_replace' && is7s) {
      complete7sReplace(pid)
      return true
    }
    return false
  }, [swapSource, actionMode, completeSwap, completeEmgReplace, complete7sReplace])

  const showPlayer = useCallback(async (pid: number) => {
    if (swapSource) return
    try {
      const data = await api<PlayerDetail>(`${API}/player/${pid}`)
      setPlayerModal(data)
    } catch { toast('Failed to load player', 'error') }
  }, [API, swapSource, toast])

  const closePlayerModal = useCallback(() => setPlayerModal(null), [])

  return {
    toastMsg, swapSource, actionMode, playerModal,
    setCaptain, setVC, startSwap, completeSwap, cancelAllModes,
    toggleEmergency, toggle7s, set7sCaptain, addToLTIL, removeFromLTIL,
    completeEmgReplace, complete7sReplace, handlePlayerClick,
    showPlayer, closePlayerModal, toast,
  }
}
