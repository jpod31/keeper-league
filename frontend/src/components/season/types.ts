/** Shapes returned by GET /api/leagues/:id/season-review. */

export interface PlayerCard {
  id: number
  name: string
  afl_team: string
  position: string
  age: number | null
  rating: number | null
  logo: string | null
  club_bg: string
  club_fg: string
  team_id?: number
  team_name?: string
  accent?: string
  selections?: number
  /** Weeks named in the 23 AND actually played. */
  played_23?: number
  /** Rounds his club took the field, i.e. the most weeks he could have played. */
  available?: number
  missed_23?: number
  ever_present?: boolean
  played?: number
  points?: number
  avg?: number
  emerg?: number
  sub_on?: number
  best?: number
  best_round?: number | null
  /** Per-round state, aligned to SeasonReviewData.rounds.
   *  2 played · 1 club bye · 0 named but out · -1 dropped */
  weeks?: number[]
  week_pts?: number[]
}

export interface LadderRow {
  pos: number
  team_id: number
  name: string
  owner: string
  logo_url: string | null
  accent: string
  wins: number
  losses: number
  draws: number
  points_for: number
  points_against: number
  percentage: number
  ladder_points: number
}

export interface ArcTeam {
  team_id: number
  name: string
  accent: string
  positions: number[]
  scores: number[]
}

export interface H2HCell {
  opp_id: number
  opp: string
  w: number
  l: number
  d: number
  for: number
  against: number
}

export interface H2HRow {
  team_id: number
  name: string
  accent: string
  cells: (H2HCell | null)[]
}

export interface Rivalry {
  a_id: number; a: string
  b_id: number; b: string
  a_wins: number; b_wins: number; draws: number
  games: number; dominance: number; avg_margin: number
}

export interface MarginRow {
  round: number
  home: string; away: string
  home_id: number; away_id: number
  home_score: number; away_score: number
  margin: number; combined: number
  winner: string; loser: string
}

export interface ScoreRow {
  score: number
  team_id: number
  name: string
  accent: string
  round: number
}

export interface Coach {
  team_id: number
  name: string
  owner: string
  logo_url: string | null
  accent: string
  position: number | null
  wins: number; losses: number; draws: number
  percentage: number
  points_for: number
  avg_score: number
  swing: number
  high: number; low: number
  churn: number
  bench_waste: number
  subs_used: number
  sevens_pos: number | null
  sevens_record: string | null
  best_player: PlayerCard | null
  draft_gem: DraftPick | null
  players_used: number
  efficiency: number
}

export interface DraftPick extends PlayerCard {
  pick: number
  draft_round: number
  value_rank: number
  surplus: number
  auto: boolean
}

export interface Award {
  key: string
  title: string
  sub: string
  team_id: number
  team_name: string
  accent: string
  logo_url: string | null
  value: string
  detail: string
  icon: string
}

export interface YourSeason {
  team_id: number
  name: string
  owner: string
  logo_url: string | null
  accent: string
  position: number | null
  wins: number; losses: number; draws: number
  points_for: number; points_against: number
  percentage: number
  ladder_points: number
  pf_rank: number | null
  avg_score: number
  best_round: { round: number; score: number } | null
  worst_round: { round: number; score: number } | null
  best_streak: number
  top_players: PlayerCard[]
  ever_present: PlayerCard[]
  arc: ArcTeam | null
  h2h: H2HRow | null
  bench: BenchRow | null
  squad_size: number
}

export interface SevensRow extends LadderRow {}

export interface BenchRow {
  team_id: number
  name: string
  accent: string
  points: number
  per_round: number
  scored: number
  efficiency: number
}

export interface SeasonReviewData {
  available: boolean
  year: number
  league: { id: number; name: string; teams: number; rounds: number; scoring: string }
  /** Round numbers the season ran, in order — the x-axis for presence strips. */
  rounds: number[]
  cover: {
    total_points: number
    players_used: number
    matches: number
    rounds: number
    teams: number
    top_round: { score: number; team: string; round: number } | null
  }
  ladder: LadderRow[]
  arc: { rounds: number[]; league_avg: number[]; teams: ArcTeam[] }
  ever_present: {
    league: PlayerCard[]
    per_team: Record<string, PlayerCard[]>
    perfect: PlayerCard[]
    perfect_count: number
    /** Weeks available to a typical player — the honest denominator. */
    max_rounds: number
  }
  best_23: {
    lines: { code: string; players: PlayerCard[] }[]
    reps: { team_id: number; name: string; accent: string; count: number }[]
    mvp: PlayerCard | null
    min_games: number
    iron_in_side: number
    iron_best: PlayerCard | null
    iron_men: PlayerCard[]
  }
  records: {
    highest: ScoreRow[]
    lowest: ScoreRow[]
    blowouts: MarginRow[]
    nailbiters: MarginRow[]
    shootouts: MarginRow[]
    single_scores: (PlayerCard & { score: number; round: number; team_name: string })[]
    tons: (PlayerCard & { tons: number; monsters: number })[]
  }
  h2h: { matrix: H2HRow[]; lopsided: Rivalry | null; closest: Rivalry | null }
  bench: {
    table: BenchRow[]
    worst: (PlayerCard & { round: number; score: number; gap: number; team_name: string })[]
    total: number
    rounds_counted: number
    rounds_excluded: number[]
    note: string
  }
  sevens: {
    ladder: SevensRow[]
    premier: SevensRow | null
    top_scorers: PlayerCard[]
    iron: PlayerCard[]
    best_average: PlayerCard[]
  }
  draft: {
    total_picks: number
    first_round: DraftPick[]
    steals: DraftPick[]
    busts: DraftPick[]
    best_by_team: { team_id: number; name: string; accent: string; best: DraftPick; worst: DraftPick; top: DraftPick }[]
  }
  movement: {
    trades: { id: number; date: string | null; period: string; sides: { team_id: number; name: string; accent: string; players: (PlayerCard & { points_after: number })[] }[] }[]
    delists: PlayerCard[]
  }
  coaches: Coach[]
  awards: Award[]
  you: YourSeason | null
}
