import { Download, Trophy } from 'lucide-react'
import type { ScoringRules, TeamStanding } from '../../domain/types'

interface StandingsPageProps {
  standings: TeamStanding[]
  scoringRules: ScoringRules
  onExport: () => void
}

export function StandingsPage({ standings, scoringRules, onExport }: StandingsPageProps) {
  return (
    <div className="page-stack">
      <div className="page-title-row standings-title">
        <div><span className="eyebrow muted-eyebrow">TABLA GENERAL · ACTUALIZACIÓN EN VIVO</span><h1>Clasificación</h1><p>Solo cuentan los resultados confirmados por el servidor.</p></div>
        <button className="button button-outline" onClick={onExport} disabled={standings.length === 0}><Download size={17} /> Exportar Excel</button>
      </div>
      <section className="surface-card standings-card">
        <div className="standings-banner">
          <div className="standings-banner-icon"><Trophy size={21} /></div>
          <div><strong>La ruta se construye en equipo</strong><span>Victoria {scoringRules.win} pts · Empate {scoringRules.draw} pts · Derrota {scoringRules.loss} pts · Caribe {scoringRules.caribeMinimum}–{scoringRules.caribeMaximum} pts</span></div>
          <span className="public-badge">VISTA PÚBLICA</span>
        </div>
        {standings.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">✳</div><h2>La clasificación empieza aquí</h2><p>Cuando se registren los equipos y se confirmen resultados, la tabla se actualizará automáticamente.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table standings-table">
              <thead><tr><th>POS.</th><th>EQUIPO</th><th>PUNTOS</th><th>VICTORIAS</th><th>EMPATES</th><th>DERROTAS</th><th>ESTACIONES</th></tr></thead>
              <tbody>
                {standings.map((standing) => (
                  <tr key={standing.team.id}>
                    <td><span className={`rank-chip ${standing.rank <= 3 ? `rank-${standing.rank}` : ''}`}>{String(standing.rank).padStart(2, '0')}</span></td>
                    <td><span className="team-name-cell"><i style={{ backgroundColor: standing.team.color }} />{standing.team.name}{standing.tied && <small>Empate</small>}</span></td>
                    <td><strong className="points-cell">{standing.totalPoints.toFixed(2)}</strong></td>
                    <td>{standing.wins}</td><td>{standing.draws}</td><td>{standing.losses}</td>
                    <td><span className="completion-chip">{standing.completedStations}/8</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="standings-footnote">Desempates: puntos totales, victorias, Caribe y enfrentamiento directo. Si persiste el empate, queda pendiente el criterio de la organización.</div>
      </section>
    </div>
  )
}
