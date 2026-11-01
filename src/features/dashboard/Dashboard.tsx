import { ArrowUpRight, CheckCircle2, Clock3, Flag, Users, Waves } from 'lucide-react'
import type { CaribeEvaluation, Match, StationGuide, Team } from '../../domain/types'

interface DashboardProps {
  teams: Team[]
  matches: Match[]
  evaluations: CaribeEvaluation[]
  stations: StationGuide[]
  onNavigate: (view: string) => void
}

export function Dashboard({ teams, matches, evaluations, stations, onNavigate }: DashboardProps) {
  const completedMatches = matches.filter((match) => match.status === 'confirmed').length
  const completedEvaluations = evaluations.filter((evaluation) => evaluation.status === 'confirmed').length
  const completed = completedMatches + completedEvaluations
  const progress = Math.round((completed / 63) * 100)
  const pending = Math.max(0, 63 - completed)

  return (
    <div className="page-stack">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> JORNADA DEPORTIVA · COLOMBIA</div>
          <h1>Un país, ocho rutas.<br /><span>Un solo equipo.</span></h1>
          <p>Coordina cada estación y sigue el recorrido de Ruta Colombia en tiempo real.</p>
          <button className="button button-light" onClick={() => onNavigate('stations')}>
            Explorar estaciones <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />
          <div className="art-label"><Waves size={16} /> 8 REGIONES · 1 AVENTURA</div>
        </div>
      </section>

      <section className="stat-grid" aria-label="Resumen del evento">
        <article className="stat-card">
          <div className="stat-icon stat-icon-blue"><Users size={19} /></div>
          <span className="stat-label">Equipos registrados</span>
          <strong>{teams.length}<small> / 14</small></strong>
          <span className="stat-foot">84 participantes esperados</span>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-yellow"><Flag size={19} /></div>
          <span className="stat-label">Enfrentamientos</span>
          <strong>{completedMatches}<small> / 49</small></strong>
          <span className="stat-foot">7 estaciones competitivas</span>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-green"><CheckCircle2 size={19} /></div>
          <span className="stat-label">Evaluaciones Caribe</span>
          <strong>{completedEvaluations}<small> / 14</small></strong>
          <span className="stat-foot">Una calificación por equipo</span>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-orange"><Clock3 size={19} /></div>
          <span className="stat-label">Registros pendientes</span>
          <strong>{pending}<small> / 63</small></strong>
          <span className="stat-foot">Resultados por confirmar</span>
        </article>
      </section>

      <section className="overview-grid">
        <article className="surface-card progress-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow muted-eyebrow">PROGRESO DEL EVENTO</span>
              <h2>La ruta hasta ahora</h2>
            </div>
            <span className="progress-value">{progress}%</span>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="progress-caption">
            <span>{completed} de 63 registros confirmados</span>
            <span>{63 - completed} restantes</span>
          </div>
          <div className="station-status-list">
            {stations.map((station) => {
              const count = station.id === 'caribe'
                ? evaluations.filter((evaluation) => evaluation.status === 'confirmed').length
                : matches.filter((match) => match.stationId === station.id && match.status === 'confirmed').length
              const total = station.id === 'caribe' ? 14 : 7
              return (
                <div className="station-status-row" key={station.id}>
                  <span className={`station-dot station-dot-${station.id}`} />
                  <span className="station-status-name">{station.region}</span>
                  <span className="station-status-bar"><span style={{ width: `${Math.min(100, (count / total) * 100)}%` }} /></span>
                  <span className="station-status-count">{count}/{total}</span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="leaderboard-teaser">
          <div className="leaderboard-top">
            <div className="eyebrow light-eyebrow">LA CLASIFICACIÓN</div>
            <div className="trophy-mark">✳</div>
          </div>
          <h2>La aventura<br />se vive en equipo.</h2>
          <p>Los puntos se suman únicamente al confirmar un resultado.</p>
          <button className="button button-yellow" onClick={() => onNavigate('standings')}>
            Ver clasificación <ArrowUpRight size={16} />
          </button>
          <div className="leaderboard-watermark">RC</div>
        </article>
      </section>
    </div>
  )
}
