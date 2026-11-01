import { useState } from 'react'
import { ArrowLeft, ChevronDown, Clock3, ShieldCheck, UsersRound } from 'lucide-react'
import type { CaribeEvaluation, Match, StationGuide } from '../../domain/types'

interface StationsPageProps {
  matches: Match[]
  evaluations: CaribeEvaluation[]
  stations: StationGuide[]
  onOpenResults: (stationId: string) => void
}

export function StationsPage({ matches, evaluations, stations, onOpenResults }: StationsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = stations.find((station) => station.id === selectedId)
  const counts = (stationId: string) => stationId === 'caribe'
    ? evaluations.filter((evaluation) => evaluation.status === 'confirmed').length
    : matches.filter((match) => match.stationId === stationId && match.status === 'confirmed').length

  if (selected) {
    return (
      <div className="page-stack">
        <button className="back-button" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Todas las estaciones</button>
        <section className="station-detail-header">
          <div className={`station-emblem station-emblem-${selected.id}`}><span>{String(stations.indexOf(selected) + 1).padStart(2, '0')}</span></div>
          <div>
            <span className="eyebrow muted-eyebrow">{selected.region.toUpperCase()} · {selected.activityType === 'collective' ? 'ACTIVIDAD COLECTIVA' : 'ENFRENTAMIENTO'}</span>
            <h1>{selected.game}</h1>
            <p>{selected.summary}</p>
          </div>
          <button className="button button-primary detail-action" onClick={() => onOpenResults(selected.id)}>Gestionar resultados</button>
        </section>
        <section className="guide-grid">
          <article className="surface-card guide-main">
            <GuideSection title="Contexto cultural" open>{selected.context}</GuideSection>
            <GuideSection title="Objetivo" open>{selected.objective}</GuideSection>
            <GuideSection title="Materiales" items={selected.materials} />
            <GuideSection title="Preparación del espacio" items={selected.preparation} />
            <GuideSection title="Instrucciones paso a paso" items={selected.instructions} numbered />
            <GuideSection title="Reglas" items={selected.rules} />
            {selected.criteria && <GuideSection title="Criterios de evaluación" items={selected.criteria} />}
          </article>
          <aside className="guide-aside">
            <div className="surface-card guide-metric">
              <UsersRound size={20} />
              <div><strong>{selected.id === 'caribe' ? '14 equipos' : '7 enfrentamientos'}</strong><span>{selected.id === 'caribe' ? 'Evaluaciones individuales' : 'Cada equipo participa una vez'}</span></div>
            </div>
            <div className="surface-card guide-metric">
              <Clock3 size={20} />
              <div><strong>{selected.estimatedMinutes ? `${selected.estimatedMinutes} min` : 'Por definir'}</strong><span>Duración de la estación</span></div>
            </div>
            <section className="safety-card">
              <div className="safety-title"><ShieldCheck size={18} /> Seguridad y operación</div>
              {selected.safety.length > 0 && <ul>{selected.safety.map((item) => <li key={item}>{item}</li>)}</ul>}
              {selected.penalties.length > 0 && <GuideSection title="Penalizaciones" items={selected.penalties} />}
              {selected.specialCases.length > 0 && <GuideSection title="Situaciones especiales" items={selected.specialCases} />}
              {selected.organizerNotes.length > 0 && <GuideSection title="Notas del organizador" items={selected.organizerNotes} />}
              {selected.safety.length === 0 && selected.penalties.length === 0 && selected.specialCases.length === 0 && selected.organizerNotes.length === 0 && <p>Sin observaciones adicionales registradas.</p>}
            </section>
            <div className="guide-progress">
              <span>Resultados confirmados</span>
              <strong>{counts(selected.id)} / {selected.id === 'caribe' ? 14 : 7}</strong>
            </div>
          </aside>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow muted-eyebrow">RECORRIDO DEL EVENTO</span><h1>Las estaciones</h1><p>Ocho experiencias inspiradas en la diversidad de Colombia.</p></div>
        <div className="station-total"><strong>08</strong><span>REGIONES</span></div>
      </div>
      <div className="station-card-grid">
        {stations.map((station, index) => {
          const resultCount = counts(station.id)
          const total = station.id === 'caribe' ? 14 : 7
          return (
            <button className={`station-card station-card-${station.id}`} key={station.id} onClick={() => setSelectedId(station.id)}>
              <div className="station-card-top">
                <span className="station-number">0{index + 1}</span>
                <span className={`activity-pill ${station.activityType}`}>{station.activityType === 'collective' ? 'Colectiva' : 'Competitiva'}</span>
              </div>
              <div className="station-card-graphic" aria-hidden="true">
                <span className="graphic-orbit" /><span className="graphic-core">{station.region.slice(0, 1)}</span>
              </div>
              <span className="station-region">{station.region}</span>
              <strong className="station-game">{station.game}</strong>
              <span className="station-summary">{station.summary}</span>
              <div className="station-card-footer">
                <span>{resultCount} de {total} registros</span>
                <span className="station-card-arrow">↗</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GuideSection({
  title,
  children,
  items,
  numbered = false,
  open = false,
}: {
  title: string
  children?: string
  items?: string[]
  numbered?: boolean
  open?: boolean
}) {
  return (
    <details className="guide-section" open={open}>
      <summary>{title}<ChevronDown size={17} /></summary>
      {children && <p>{children}</p>}
      {items && (
        <ol className={numbered ? 'numbered-list' : ''}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ol>
      )}
    </details>
  )
}
