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

export function useFieldActions(leagueId: string, teamId: string, onRefresh: () => void) {
  const API = `/leagues/${leagueId}/team/${teamId}/api`
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null)
  const [swapSource, setSwapSource] = useState<number | null>(null)
  const [emgSource, setEmgSource] = useState<number | null>(null)
  const [sevensSource, setSevensSource] = useState<number | null>(null)
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
    const data = await fvApi('/set-captain', { player_id: pid })
    if (!data.error) { toast('Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const setVC = useCallback(async (pid: number) => {
    const data = await fvApi('/set-vc', { player_id: pid })
    if (!data.error) { toast('Vice Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const swap = useCallback(async (pid1: number, pid2: number) => {
    const data = await fvApi('/swap', { player_id_1: pid1, player_id_2: pid2 })
    if (!data.error) { toast('Players swapped', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const toggleEmergency = useCallback(async (pid: number) => {
    const data = await fvApi('/set-emergency', { player_id: pid })
    if (!data.error) { onRefresh() }
  }, [fvApi, onRefresh])

  const toggle7s = useCallback(async (pid: number) => {
    const data = await fvApi('/toggle-7s', { player_id: pid })
    if (!data.error) { onRefresh() }
  }, [fvApi, onRefresh])

  const set7sCaptain = useCallback(async (pid: number) => {
    const data = await fvApi('/set-7s-captain', { player_id: pid })
    if (!data.error) { toast('7s Captain updated', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const addToLTIL = useCallback(async (pid: number) => {
    const data = await fvApi('/add-to-ltil', { player_id: pid })
    if (!data.error) { toast('Added to LTIL', 'success'); onRefresh() }
  }, [fvApi, toast, onRefresh])

  const startSwap = useCallback((pid: number) => {
    setEmgSource(null); setSevensSource(null)
    setSwapSource(prev => prev === pid ? null : pid)
  }, [])

  const completeSwap = useCallback((targetPid: number) => {
    if (swapSource && swapSource !== targetPid) {
      const src = swapSource
      setSwapSource(null)
      swap(src, targetPid)
    }
  }, [swapSource, swap])

  const cancelAllModes = useCallback(() => {
    setSwapSource(null); setEmgSource(null); setSevensSource(null)
  }, [])

  const showPlayer = useCallback(async (pid: number) => {
    if (swapSource || emgSource || sevensSource) return
    try {
      const data = await api<PlayerDetail>(`${API}/player/${pid}`)
      setPlayerModal(data)
    } catch { toast('Failed to load player', 'error') }
  }, [API, swapSource, emgSource, sevensSource, toast])

  const closePlayerModal = useCallback(() => setPlayerModal(null), [])

  return {
    toastMsg, swapSource, emgSource, sevensSource, playerModal,
    setCaptain, setVC, startSwap, completeSwap, cancelAllModes,
    toggleEmergency, toggle7s, set7sCaptain, addToLTIL,
    showPlayer, closePlayerModal, toast,
  }
}
