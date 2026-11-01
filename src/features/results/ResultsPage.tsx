import { useState } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle, LockKeyhole, Save } from 'lucide-react'
import { caribePoints, consolidateCaribeScore } from '../../domain/scoring'
import type { CaribeEvaluation, Match, ScoringRules, StationGuide, Team } from '../../domain/types'
import type { SessionUser } from '../../services/firebase/auth'

interface ResultsPageProps {
  teams: Team[]
  matches: Match[]
  evaluations: CaribeEvaluation[]
  stations: StationGuide[]
  scoringRules: ScoringRules
  session: SessionUser | null
  configured: boolean
  initialStationId?: string
  onConfirmMatch: (matchId: string, winnerTeamId: string | 'draw') => Promise<void>
  onCorrectMatch: (matchId: string, winnerTeamId: string | 'draw') => Promise<void>
  onConfirmCaribe: (input: { teamId: string; criteriaScores: Record<string, number>; evaluators: string[]; observations: string }) => Promise<void>
  onSaveCaribeDraft: (input: { teamId: string; criteriaScores: Record<string, number>; evaluators: string[]; observations: string }) => Promise<void>
  onCorrectCaribe: (input: { teamId: string; criteriaScores: Record<string, number>; observations: string }) => Promise<void>
}

export function ResultsPage(props: ResultsPageProps) {
  const [stationId, setStationId] = useState(props.initialStationId ?? props.stations[0].id)
  const station = props.stations.find((item) => item.id === stationId) ?? props.stations[0]
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow muted-eyebrow">OPERACIÓN EN ESTACIÓN</span><h1>Resultados</h1><p>Registra cada resultado una sola vez; la tabla se calcula desde confirmaciones.</p></div>
        <label className="station-select-label">ESTACIÓN
          <select value={stationId} onChange={(event) => setStationId(event.target.value)}>
            {props.stations.map((item) => <option key={item.id} value={item.id}>{item.region} · {item.game}</option>)}
          </select>
        </label>
      </div>
      {!props.configured && <div className="notice notice-warning"><CircleAlert size={18} /> Firebase no está configurado. Puedes consultar la interfaz, pero no se pueden guardar ni simular resultados.</div>}
      {station.activityType === 'collective'
        ? <CaribeResults {...props} station={station} />
        : <MatchResults {...props} stationId={station.id} />}
    </div>
  )
}

function MatchResults({
  teams, matches, session, configured, stationId, onConfirmMatch, onCorrectMatch,
}: ResultsPageProps & { stationId: string }) {
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stationMatches = matches.filter((match) => match.stationId === stationId)
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const canWrite = session?.role === 'admin' || (session?.role === 'collaborator' && session.stationIds.includes(stationId))
  const canCorrect = session?.role === 'admin'

  async function confirm(match: Match) {
    const winnerTeamId = choices[match.id]
    const isCorrection = match.status === 'confirmed'
    if (!winnerTeamId || (isCorrection && winnerTeamId === match.winnerTeamId)) return
    const question = isCorrection
      ? '¿Deseas corregir el resultado confirmado? El cambio quedará registrado en auditoría.'
      : '¿Confirmas este resultado? No se podrá modificar sin autorización administrativa.'
    if (!window.confirm(question)) return
    setError(null)
    setBusyId(match.id)
    try {
      if (isCorrection) await onCorrectMatch(match.id, winnerTeamId)
      else await onConfirmMatch(match.id, winnerTeamId)
      setChoices((current) => ({ ...current, [match.id]: '' }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo confirmar el resultado.')
    } finally {
      setBusyId(null)
    }
  }

  if (stationMatches.length === 0) {
    return <EmptyOperations configured={configured} message="La programación aún no se ha generado para esta estación." />
  }
  return (
    <div className="results-list">
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {stationMatches.map((match, index) => {
        const teamA = teamById.get(match.teamAId)
        const teamB = teamById.get(match.teamBId)
        const confirmed = match.status === 'confirmed'
        return (
          <article className={`surface-card match-card ${confirmed ? 'match-confirmed' : ''}`} key={match.id}>
            <div className="match-meta"><span>ENFRENTAMIENTO {String(index + 1).padStart(2, '0')}</span><span className={`status-pill ${confirmed ? 'status-confirmed' : 'status-pending'}`}>{confirmed ? <><CheckCircle2 size={13} /> Confirmado</> : 'Pendiente'}</span></div>
            <div className="match-teams">
              <button className={`match-team ${choices[match.id] === match.teamAId ? 'selected' : ''}`} disabled={(confirmed && !canCorrect) || !canWrite || !teamA} onClick={() => setChoices((current) => ({ ...current, [match.id]: match.teamAId }))}>
                <i style={{ background: teamA?.color ?? '#d5d9d8' }} /><strong>{teamA?.name ?? 'Equipo sin configurar'}</strong><span>A</span>
              </button>
              <span className="versus">VS</span>
              <button className={`match-team ${choices[match.id] === match.teamBId ? 'selected' : ''}`} disabled={(confirmed && !canCorrect) || !canWrite || !teamB} onClick={() => setChoices((current) => ({ ...current, [match.id]: match.teamBId }))}>
                <i style={{ background: teamB?.color ?? '#d5d9d8' }} /><strong>{teamB?.name ?? 'Equipo sin configurar'}</strong><span>B</span>
              </button>
            </div>
            <div className="match-bottom">
              <button className={`draw-option ${choices[match.id] === 'draw' ? 'selected' : ''}`} disabled={(confirmed && !canCorrect) || !canWrite} onClick={() => setChoices((current) => ({ ...current, [match.id]: 'draw' }))}>Registrar empate</button>
              <div className="match-actions">
                {confirmed && <span className="server-confirmed">{match.pointsA ?? '—'} : {match.pointsB ?? '—'} pts · Confirmado</span>}
                {!canWrite && !confirmed && <span className="permission-note"><LockKeyhole size={14} /> Estación no asignada</span>}
                {(!confirmed || canCorrect) && <button className="button button-primary button-small" disabled={!choices[match.id] || (confirmed && choices[match.id] === match.winnerTeamId) || busyId === match.id || !configured || !canWrite} onClick={() => void confirm(match)}>
                  {busyId === match.id ? <><LoaderCircle className="spin" size={15} /> Enviando</> : <><Save size={15} /> {confirmed ? 'Corregir' : 'Confirmar'}</>}
                </button>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function CaribeResults({
  teams, evaluations, session, configured, onConfirmCaribe, onSaveCaribeDraft, onCorrectCaribe, station,
  scoringRules,
}: ResultsPageProps & { station: StationGuide }) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [observations, setObservations] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const completed = new Map(evaluations.filter((evaluation) => evaluation.status === 'confirmed').map((evaluation) => [evaluation.teamId, evaluation]))
  const drafts = new Map(evaluations.filter((evaluation) => evaluation.status === 'pending').map((evaluation) => [evaluation.teamId, evaluation]))
  const canWrite = session?.role === 'admin' || (session?.role === 'collaborator' && session.stationIds.includes(station.id))
  const canCorrect = session?.role === 'admin'
  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const selectedEvaluation = completed.get(selectedTeamId) ?? drafts.get(selectedTeamId)
  const scoreValues = station.criteria ?? []
  const completedScores = Object.fromEntries(scoreValues.map((criterion) => [criterion, scores[criterion] ?? 0]))
  const consolidatedScore = scoreValues.length > 0
    ? consolidateCaribeScore(completedScores, scoreValues, scoringRules)
    : 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const isCorrection = selectedEvaluation?.status === 'confirmed'
    if (!selectedTeam || !session || (isCorrection && !canCorrect)) return
    const question = isCorrection
      ? `¿Deseas corregir la evaluación de ${selectedTeam.name}? El cambio quedará registrado en auditoría.`
      : `¿Confirmas la evaluación de ${selectedTeam.name}?`
    if (!window.confirm(question)) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (isCorrection) {
        await onCorrectCaribe({ teamId: selectedTeam.id, criteriaScores: scores, observations })
        setSuccess('Corrección confirmada por el servidor y registrada en auditoría.')
      } else {
        await onConfirmCaribe({
          teamId: selectedTeam.id,
          criteriaScores: scores,
          evaluators: [session.uid],
          observations,
        })
        setSuccess('Evaluación confirmada por el servidor.')
        setSelectedTeamId('')
        setScores({})
        setObservations('')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la evaluación.')
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!selectedTeam || !session) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await onSaveCaribeDraft({
        teamId: selectedTeam.id,
        criteriaScores: scores,
        evaluators: [session.uid],
        observations,
      })
      setSuccess('Borrador guardado; todavía no cuenta para la clasificación.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el borrador.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="caribe-layout">
      <section className="surface-card caribe-team-list">
        <div className="subsection-title"><UsersRoundIcon /><strong>Evaluaciones por equipo</strong><span>{completed.size}/14</span></div>
        {teams.map((team) => {
          const evaluation = completed.get(team.id)
          const draft = drafts.get(team.id)
          return <button key={team.id} className={`caribe-team-row ${selectedTeamId === team.id ? 'selected' : ''}`} disabled={(Boolean(evaluation) && !canCorrect) || !canWrite} onClick={() => { const saved = evaluation ?? draft; setSelectedTeamId(team.id); setScores(saved?.criteriaScores ?? {}); setObservations(saved?.observations ?? ''); setSuccess(null) }}>
            <i style={{ background: team.color }} /><span>{team.name}</span>
            {evaluation ? <strong>{evaluation.points.toFixed(2)} pts</strong> : draft ? <small>Borrador</small> : <small>Pendiente</small>}
          </button>
        })}
        {teams.length === 0 && <p className="empty-inline">Registra equipos antes de evaluar Caribe.</p>}
      </section>
      <section className="surface-card evaluation-form">
        {selectedTeam ? <>
          <span className="eyebrow muted-eyebrow">EVALUACIÓN INDIVIDUAL</span>
          <h2>{selectedTeam.name}</h2>
          <p>Califica cada criterio entre 0 y {scoringRules.caribeScaleMaximum}. La consolidación aplica el método y los pesos configurados.</p>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {success && <div className="notice notice-success" role="status">{success}</div>}
          <form onSubmit={submit}>
            {scoreValues.map((criterion) => <label className="score-field" key={criterion}><span>{criterion}<strong>{scores[criterion] ?? 0}</strong></span><input type="range" min="0" max={scoringRules.caribeScaleMaximum} step="1" value={Math.min(scores[criterion] ?? 0, scoringRules.caribeScaleMaximum)} onChange={(event) => setScores((current) => ({ ...current, [criterion]: Number(event.target.value) }))} /></label>)}
            <label className="field-label">Observaciones<textarea rows={3} maxLength={1000} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Notas para la organización" /></label>
            <div className="score-preview"><span>Consolidado <strong>{consolidatedScore.toFixed(2)} / {scoringRules.caribeScaleMaximum}</strong></span><span>Puntos Caribe <strong>{caribePoints(consolidatedScore, scoringRules).toFixed(2)}</strong></span></div>
            <div className="evaluation-actions">
              <button type="button" className="button button-outline" disabled={!configured || !canWrite || busy} onClick={() => void saveDraft()}>{busy ? 'Guardando…' : 'Guardar borrador'}</button>
              <button type="submit" className="button button-primary" disabled={!configured || !canWrite || busy || (selectedEvaluation?.status === 'confirmed' && !canCorrect)}>{busy ? 'Enviando…' : selectedEvaluation?.status === 'confirmed' ? 'Corregir evaluación' : 'Confirmar evaluación'}</button>
            </div>
          </form>
        </> : <div className="empty-state"><div className="empty-state-icon">♪</div><h2>Selecciona un equipo</h2><p>Cada equipo recibe su propia evaluación. Caribe no genera enfrentamientos.</p></div>}
      </section>
    </div>
  )
}

function EmptyOperations({ configured, message }: { configured: boolean; message: string }) {
  return <div className="surface-card empty-state"><div className="empty-state-icon"><CircleAlert size={22} /></div><h2>{message}</h2><p>{configured ? 'El administrador puede generar la programación cuando los 14 equipos estén listos.' : 'Conecta Firebase para cargar registros reales.'}</p></div>
}

function UsersRoundIcon() {
  return <CheckCircle2 size={17} aria-hidden="true" />
}
