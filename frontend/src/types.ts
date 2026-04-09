export interface AnalyticsData {
  team: { id: number; name: string }
  analytics: Analytics
  dynasty: Record<string, DynastyTeam>
  narrative: Narrative
  ai_sections: AiSection[]
  squad_depth: Record<string, PositionDepth>
  trade_table: TradeTable
  landscape: LandscapeTeam[]
}

export interface Analytics {
  health_score: number
  health_components: Record<string, number>
  season_avg: number
  avg_sc: number
  avg_age: number
  window: string
  window_detail: string
  form_avg: number
  form_vs_season: number
  total_sc: number
  top5_pct: number
  sc_std: number
  sc_vs_league: number
  age_vs_league: number
  league_context: {
    avg_sc_rank: RankInfo
    total_sc_rank: RankInfo
    avg_age_rank: RankInfo
    n_teams: number
  }
  round_data: { round: number; score: number }[]
  insights: Insight[]
  player_bayesian: PlayerBayesian[]
  aging_in: AgingPlayer[]
  aging_out: AgingPlayer[]
  avg_consistency: number
  avg_durability: number
  tier_counts: Record<string, number>
  pos_breakdown: Record<string, { count: number; avg_sc: number; diff: number }>
}

export interface RankInfo {
  rank: number
  of: number
  value: number
  league_avg: number
  leader: number
  gap_to_leader: number
}

export interface Insight {
  type: 'warning' | 'opportunity' | 'strength'
  title: string
  detail: string
  impact: number
}

export interface PlayerBayesian {
  name: string
  position: string
  role_bucket: string
  age: number
  height: number
  games: number
  raw_avg: number
  true_talent: number
  ceiling: number
  floor: number
  tag: string
  tag_css: string
  is_field: boolean
  regression_pct: number
  round_scores: number[]
}

export interface DynastyTeam {
  name: string
  years: { year: number; total: number; squad: { name: string; position: string; sc: number; age: number }[] }[]
}

export interface Narrative {
  verdict: string
  trajectory: string
  crossovers: { year: number; event: string; team: string }[]
  kid_timeline: { year: number; enters: string; replaces: string; enters_age: number; enters_sc: number }[]
  biggest_gap: { position: string; gap: number; your_avg: number; league_avg: number; weakest: string; weakest_sc: number; best_fill_name: string; best_fill_sc: number } | null
  dependency: { level: string; detail: string }
}

export interface AiSection {
  title: string
  body: string
}

export interface PositionDepth {
  players: DepthPlayer[]
  avg_sc: number
  league_avg: number
  diff: number
  count: number
}

export interface DepthPlayer {
  name: string
  sc: number
  tag: string
  tag_css: string
  trajectory: string
  age: number
  peak_phase: string
}

export interface TradeTable {
  gaps: { position: string; gap: number; avg_sc: number; league_avg: number; weakest_player: string; weakest_sc: number }[]
  free_agents: TradeTarget[]
  trade_targets: TradeTarget[]
  surplus: TradeTarget[]
}

export interface TradeTarget {
  name: string
  position: string
  age: number
  sc_avg: number
  tag: string
  tag_css: string
  fills_gap: boolean
  owner?: string
  reason?: string
}

export interface LandscapeTeam {
  team_id: number
  name: string
  total_sc: number
  avg_sc: number
  count: number
}

export interface AgingPlayer {
  name: string
  age: number
  current_sc: number
  projected_sc: number
  change: number
}
