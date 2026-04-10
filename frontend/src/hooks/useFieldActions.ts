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

/** Check if two players can swap positions (matching original _checkSwapEligible logic) */
function checkSwapEligible(
  srcPositions: string[], srcSection: string, srcFieldPos: string,
  tgtPositions: string[], tgtSection: string, tgtFieldPos: string,
): boolean {
  function canFillSlot(playerPositions: string[], slotSection: string, slotFieldPos: string) {
    // Flex and reserve slots accept any player
    if (slotSection === 'flex' || slotSection === 'reserve') return true
    // Field slot requires the player to have that position
    return playerPositions.includes(slotFieldPos)
  }
  // Both players must be able to fill each other's slot
  return canFillSlot(srcPositions, tgtSection, tgtFieldPos)
      && canFillSlot(tgtPositions, srcSection, srcFieldPos)
}

/** Get section/positions/fieldPos for a player from the DOM, matching original */
function getPlayerSlotInfo(pid: number): { section: string; positions: string[]; fieldPos: string } | null {
  const el = document.querySelector(`[data-player-id="${pid}"]`) as HTMLElement
  if (!el) return null
  return {
    section: el.dataset.section || '',
    positions: (el.dataset.positions || 'MID').split('/'),
    fieldPos: el.dataset.fieldPos || '',
  }
}

export type ActionMode = 'swap' | 'emg_replace' | '7s_replace' | null

export function useFieldActions(
  leagueId: string, teamId: string, onRefresh: () => void,
  ageCutoff = 24, maxSenior7s = 2,
) {
  const API = `/leagues/${leagueId}/team/${teamId}/api`
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null)
  const [swapSource, setSwapSource] = useState<number | null>(null)
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

  // ── Simple actions ──
  const setCaptain = useCallback(async (pid: number) => {
    const data = await fvApi('/set-captain', { player_id: pid })
    if (!data.error) { toast('Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const setVC = useCallback(async (pid: number) => {
    const data = await fvApi('/set-vc', { player_id: pid })
    if (!data.error) { toast('Vice Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const set7sCaptain = useCallback(async (pid: number) => {
    const data = await fvApi('/set-7s-captain', { player_id: pid })
    if (!data.error) { toast('7s Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const addToLTIL = useCallback(async (pid: number) => {
    const data = await fvApi('/add-to-ltil', { player_id: pid })
    if (!data.error) { toast('Added to LTIL', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  // ── Cancel all modes ──
  const cancelAllModes = useCallback(() => {
    setSwapSource(null)
    setActionMode(null)
  }, [])

  // ── Swap: start with position eligibility checking ──
  const startSwap = useCallback((pid: number) => {
    // Cancel if tapping same player
    if (swapSource === pid) { cancelAllModes(); return }
    // Cancel other modes
    cancelAllModes()

    setSwapSource(pid)
    setActionMode('swap')

    // Mark eligible targets in the DOM (for CSS highlighting)
    const srcInfo = getPlayerSlotInfo(pid)
    if (!srcInfo) return

    document.querySelectorAll('[data-player-id]').forEach(el => {
      const htmlEl = el as HTMLElement
      htmlEl.classList.remove('fv-swap-active', 'fv-swap-eligible')
      const tid = parseInt(htmlEl.dataset.playerId || '0')
      if (tid === pid) { htmlEl.classList.add('fv-swap-active'); return }
      if (htmlEl.dataset.locked === '1') return
      if (!htmlEl.dataset.section) return

      const tgtInfo = {
        section: htmlEl.dataset.section || '',
        positions: (htmlEl.dataset.positions || 'MID').split('/'),
        fieldPos: htmlEl.dataset.fieldPos || '',
      }

      if (checkSwapEligible(
        srcInfo.positions, srcInfo.section, srcInfo.fieldPos,
        tgtInfo.positions, tgtInfo.section, tgtInfo.fieldPos,
      )) {
        htmlEl.classList.add('fv-swap-eligible')
      }
    })
  }, [swapSource, cancelAllModes])

  // ── Swap: complete with animation ──
  const completeSwap = useCallback((targetPid: number) => {
    if (!swapSource || swapSource === targetPid) return

    // Check the target is actually eligible
    const targetEl = document.querySelector(`[data-player-id="${targetPid}"]`) as HTMLElement
    if (targetEl && !targetEl.classList.contains('fv-swap-eligible')) {
      // Not eligible — handle emg/7s replacement modes
      if (actionMode === 'emg_replace' && targetEl.dataset.emg === '1') {
        // Replace this emergency with the source
        const sourcePid = swapSource
        cancelAllModes()
        fvApi('/set-emergency', { player_id: targetPid }).then(d1 => {
          if (d1.error) return
          fvApi('/set-emergency', { player_id: sourcePid }).then(() => onRefresh())
        })
        return
      }
      if (actionMode === '7s_replace' && targetEl.dataset.sevens === '1') {
        // Replace this 7s player with the source
        const sourcePid = swapSource
        cancelAllModes()
        fvApi('/toggle-7s', { player_id: targetPid }).then(d1 => {
          if (d1.error) return
          fvApi('/toggle-7s', { player_id: sourcePid }).then(() => onRefresh())
        })
        return
      }
      return // Not eligible, ignore
    }

    const savedSource = swapSource
    cancelAllModes()

    // Clear CSS classes
    document.querySelectorAll('[data-player-id]').forEach(el => {
      (el as HTMLElement).classList.remove('fv-swap-active', 'fv-swap-eligible')
    })

    // Find DOM elements for animation
    const sourceEl = document.querySelector(`[data-player-id="${savedSource}"]`) as HTMLElement
    const tgtEl = document.querySelector(`[data-player-id="${targetPid}"]`) as HTMLElement

    if (!sourceEl || !tgtEl) {
      fvApi('/swap', { player_id_1: savedSource, player_id_2: targetPid }).then(data => {
        if (!data.error) { toast('Players swapped', 'success'); onRefresh() }
      })
      return
    }

    // Animated swap
    const srcRect = sourceEl.getBoundingClientRect()
    const tgtRect = tgtEl.getBoundingClientRect()
    const dx = tgtRect.left - srcRect.left
    const dy = tgtRect.top - srcRect.top

    sourceEl.style.zIndex = '10'
    tgtEl.style.zIndex = '10'
    sourceEl.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
    tgtEl.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)'
    sourceEl.style.transform = `translate(${dx}px, ${dy}px)`
    tgtEl.style.transform = `translate(${-dx}px, ${-dy}px)`

    const apiPromise = fvApi('/swap', { player_id_1: savedSource, player_id_2: targetPid })
    const animDone = new Promise<void>(r => setTimeout(r, 370))

    Promise.all([apiPromise, animDone]).then(([data]) => {
      ;[sourceEl, tgtEl].forEach(el => {
        el.style.transform = ''
        el.style.transition = ''
        el.style.zIndex = ''
      })
      if (data && !data.error) {
        toast('Players swapped', 'success')
        onRefresh()
      }
    })
  }, [swapSource, actionMode, fvApi, toast, onRefresh, cancelAllModes])

  // ── Emergency: with replacement mode when full ──
  const toggleEmergency = useCallback((pid: number) => {
    // If already in emg replace mode for this player, cancel
    if (swapSource === pid && actionMode === 'emg_replace') { cancelAllModes(); return }
    cancelAllModes()

    const card = document.querySelector(`[data-player-id="${pid}"]`) as HTMLElement
    if (!card || card.dataset.locked === '1') return
    const isEmg = card.dataset.emg === '1'

    if (isEmg) {
      // Already emergency — toggle off
      fvApi('/set-emergency', { player_id: pid }).then(data => {
        if (!data.error) onRefresh()
      })
    } else {
      // Check if room
      const currentEmgCount = document.querySelectorAll('[data-emg="1"]').length
      if (currentEmgCount < 4) {
        // Room available — add directly
        fvApi('/set-emergency', { player_id: pid }).then(data => {
          if (!data.error) onRefresh()
        })
      } else {
        // Full — enter replacement mode
        setSwapSource(pid)
        setActionMode('emg_replace')

        document.querySelectorAll('[data-player-id]').forEach(el => {
          const htmlEl = el as HTMLElement
          htmlEl.classList.remove('fv-swap-active', 'fv-swap-eligible')
          const cid = parseInt(htmlEl.dataset.playerId || '0')
          if (cid === pid) { htmlEl.classList.add('fv-swap-active'); return }
          if (htmlEl.dataset.locked === '1') return
          // Eligible: current unlocked emergencies
          if (htmlEl.dataset.emg === '1') {
            htmlEl.classList.add('fv-swap-eligible')
          }
        })
        toast('Emergency slots full — select one to replace', 'info')
      }
    }
  }, [swapSource, actionMode, fvApi, onRefresh, toast, cancelAllModes])

  // ── 7s: with replacement mode when full + age cutoff ──
  const toggle7s = useCallback((pid: number) => {
    // If already in 7s replace mode for this player, cancel
    if (swapSource === pid && actionMode === '7s_replace') { cancelAllModes(); return }
    cancelAllModes()

    const card = document.querySelector(`[data-player-id="${pid}"]`) as HTMLElement
    if (!card || card.dataset.locked === '1') return
    const is7s = card.dataset.sevens === '1'

    // Count current seniors in 7s
    const current7sCards = document.querySelectorAll('[data-sevens="1"]')
    let seniorCount = 0
    current7sCards.forEach(c => {
      const age = parseInt((c as HTMLElement).dataset.age || '0')
      if (age >= ageCutoff) seniorCount++
    })

    if (is7s) {
      // Already in 7s — toggle off
      fvApi('/toggle-7s', { player_id: pid }).then(data => {
        if (!data.error) onRefresh()
      })
    } else {
      if (current7sCards.length < 7) {
        // Check age eligibility
        const playerAge = parseInt(card.dataset.age || '0')
        if (playerAge >= ageCutoff && seniorCount >= maxSenior7s) {
          toast(`Max ${maxSenior7s} senior (${ageCutoff}+) players in 7s`, 'error')
          return
        }
        // Room available — add directly
        fvApi('/toggle-7s', { player_id: pid }).then(data => {
          if (!data.error) onRefresh()
        })
      } else {
        // Full — enter replacement mode
        setSwapSource(pid)
        setActionMode('7s_replace')

        const srcAge = parseInt(card.dataset.age || '0')
        const srcIsSenior = srcAge >= ageCutoff

        document.querySelectorAll('[data-player-id]').forEach(el => {
          const htmlEl = el as HTMLElement
          htmlEl.classList.remove('fv-swap-active', 'fv-swap-eligible')
          const cid = parseInt(htmlEl.dataset.playerId || '0')
          if (cid === pid) { htmlEl.classList.add('fv-swap-active'); return }
          if (htmlEl.dataset.locked === '1') return
          if (htmlEl.dataset.sevens !== '1') return
          // If source is senior, can only replace another senior (unless under limit)
          if (srcIsSenior) {
            const tgtAge = parseInt(htmlEl.dataset.age || '0')
            const tgtIsSenior = tgtAge >= ageCutoff
            if (!tgtIsSenior && seniorCount >= maxSenior7s) return
          }
          htmlEl.classList.add('fv-swap-eligible')
        })
        toast('7s squad full — select one to replace', 'info')
      }
    }
  }, [swapSource, actionMode, fvApi, onRefresh, toast, cancelAllModes, ageCutoff, maxSenior7s])

  // ── Player scouting report ──
  const showPlayer = useCallback(async (pid: number) => {
    if (swapSource) return // Don't open modal during swap/replace modes
    try {
      const data = await api<PlayerDetail>(`${API}/player/${pid}`)
      setPlayerModal(data)
    } catch { toast('Failed to load player', 'error') }
  }, [API, swapSource, toast])

  const closePlayerModal = useCallback(() => setPlayerModal(null), [])

  return {
    toastMsg, swapSource, actionMode, playerModal,
    setCaptain, setVC, startSwap, completeSwap, cancelAllModes,
    toggleEmergency, toggle7s, set7sCaptain, addToLTIL,
    showPlayer, closePlayerModal, toast,
  }
}
