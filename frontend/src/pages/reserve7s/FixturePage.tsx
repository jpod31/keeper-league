import { FixturePage as MainFixturePage } from '../matchups/FixturePage'

/**
 * 7s Fixture — reuses the Main FixturePage component with mode="sevens"
 * so the visual and behaviour stay identical across the two competitions.
 */
export function Reserve7sFixturePage() {
  return <MainFixturePage mode="sevens" />
}
