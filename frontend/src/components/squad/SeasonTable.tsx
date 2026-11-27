// The season stats table on the player card (models/season_table.py): stats
// down the side, a column per season, his best season for each stat in bold,
// the latest season shaded. Styles: .st-* in static/style.css.

export interface SeasonTableData {
  cols: { year: number; comp: string; team: string | null; games: number }[]
  groups: { name: string; rows: { label: string; fmt: '1' | 'int' | 'pct'; vals: (number | null)[] }[] }[]
}

function fmt(v: number | null, f: string) {
  if (v == null) return '-'
  if (f === 'pct') return Math.round(v) + '%'
  if (f === 'int') return String(Math.round(v))
  return v.toFixed(1)
}

export function SeasonTable({ data }: { data: SeasonTableData }) {
  const wide = data.cols.length > 3
  return (
    <div className="st-wrap">
      <table className={'st' + (wide ? ' st-wide' : '')}>
        <thead>
          <tr>
            <th></th>
            {data.cols.map((c, i) => (
              <th key={i} className={i === 0 ? 'now' : ''} title={c.team || ''}>
                <b>{c.year}</b><span>{c.comp}</span><span>{c.games} gm</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.groups.map(g => {
            const single = g.rows.length === 1 && g.rows[0].label === g.name
            return [
              <tr key={g.name} className="st-grp"><td colSpan={data.cols.length + 1}>{single ? '' : g.name}</td></tr>,
              ...g.rows.map(r => {
                const have = r.vals.filter((v): v is number => v != null)
                const best = have.length > 1 ? Math.max(...have) : null
                return (
                  <tr key={g.name + r.label}>
                    <td>{r.label}</td>
                    {r.vals.map((v, i) => <td key={i} className={(i === 0 ? 'now' : '') + (v != null && v === best ? ' top' : '')}>{fmt(v, r.fmt)}</td>)}
                  </tr>
                )
              }),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
