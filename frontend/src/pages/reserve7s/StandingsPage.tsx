import { StandingsPage as MainStandingsPage } from '../matchups/StandingsPage'

/**
 * 7s Ladder — reuses the Main StandingsPage component with mode="sevens".
 * Identical layout and behaviour; green accents get repainted purple.
 */
export function Reserve7sStandingsPage() {
  return <MainStandingsPage mode="sevens" />
}
