import { useEffect, useState } from 'react'
import { isFirebaseConfigured } from '../services/firebase/config'
import type { LiveSnapshot } from '../services/firebase/eventRepository'
import { DEFAULT_SCORING_RULES, type AuditEntry, type CaribeEvaluation, type EventUser, type Match, type ScoringRules, type StationGuide, type Team } from '../domain/types'
import type { SessionUser } from '../services/firebase/auth'
import { STATIONS } from '../domain/stations'

const emptySnapshot = <T,>(): LiveSnapshot<T> => ({ items: [], fromCache: false, hasPendingWrites: false })
const emptyPrivateSnapshot = { uid: '', snapshot: emptySnapshot<Team>() }

export function useEventData() {
  const [teamsSnapshot, setTeamsSnapshot] = useState(() => emptySnapshot<Team>())
  const [privateTeamsState, setPrivateTeamsState] = useState(emptyPrivateSnapshot)
  const [privateUsersState, setPrivateUsersState] = useState({ uid: '', users: [] as EventUser[] })
  const [privateAuditState, setPrivateAuditState] = useState({ uid: '', entries: [] as AuditEntry[] })
  const [matchesSnapshot, setMatchesSnapshot] = useState(() => emptySnapshot<Match>())
  const [evaluationsSnapshot, setEvaluationsSnapshot] = useState(() => emptySnapshot<CaribeEvaluation>())
  const [privateEvaluationsState, setPrivateEvaluationsState] = useState({ uid: '', snapshot: emptySnapshot<CaribeEvaluation>() })
  const [stations, setStations] = useState<StationGuide[]>(STATIONS)
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured)
  const [hasServerSnapshot, setHasServerSnapshot] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const reportError = (reason: Error) => setError(reason.message)
    let active = true
    let stops: Array<() => void> = []
    void Promise.all([
      import('../services/firebase/eventRepository'),
      import('../services/firebase/auth'),
    ]).then(([repository, authService]) => {
      if (!active) return
      stops = [
        repository.subscribeTeams((snapshot) => {
          setTeamsSnapshot(snapshot)
          if (!snapshot.fromCache) setHasServerSnapshot(true)
        }, reportError),
        repository.subscribeMatches((snapshot) => {
          setMatchesSnapshot(snapshot)
          if (!snapshot.fromCache) setHasServerSnapshot(true)
        }, reportError),
        repository.subscribeEvaluations((snapshot) => {
          setEvaluationsSnapshot(snapshot)
          if (!snapshot.fromCache) setHasServerSnapshot(true)
        }, reportError),
        repository.subscribeStations(setStations, reportError),
        repository.subscribeScoringRules(setScoringRules, reportError),
        authService.observeSession((user) => {
          setSession(user)
          setAuthLoading(false)
        }, (reason) => {
          reportError(reason)
          setAuthLoading(false)
        }),
      ]
    }).catch((reason: unknown) => {
      reportError(reason instanceof Error ? reason : new Error('No se pudo iniciar Firebase.'))
      setAuthLoading(false)
    })
    return () => {
      active = false
      stops.forEach((stop) => stop())
    }
  }, [])

  useEffect(() => {
    const canReadPrivateEventData = session?.role === 'admin'
      || (session?.role === 'collaborator' && session.stationIds.includes('caribe'))
    if (!isFirebaseConfigured || !canReadPrivateEventData || !session) return
    let active = true
    let stops: Array<() => void> = []
    void import('../services/firebase/eventRepository').then((repository) => {
      if (!active) return
      stops = [
        ...(session.role === 'admin' ? [
          repository.subscribePrivateTeams(
            (snapshot) => setPrivateTeamsState({ uid: session.uid, snapshot }),
            (reason) => setError(reason.message),
          ),
          repository.subscribeUsers(
            (users) => setPrivateUsersState({ uid: session.uid, users }),
            (reason) => setError(reason.message),
          ),
          repository.subscribeAuditLogs(
            (entries) => setPrivateAuditState({ uid: session.uid, entries }),
            (reason) => setError(reason.message),
          ),
        ] : []),
        repository.subscribePrivateEvaluations(
          (snapshot) => setPrivateEvaluationsState({ uid: session.uid, snapshot }),
          (reason) => setError(reason.message),
        ),
      ]
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar la información privada de los equipos.')
    })
    return () => {
      active = false
      stops.forEach((stop) => stop())
    }
  }, [session])

  const authorizedPrivateSnapshot = session?.role === 'admin' && privateTeamsState.uid === session.uid
    ? privateTeamsState.snapshot
    : emptySnapshot<Team>()
  const privateTeams = new Map(authorizedPrivateSnapshot.items.map((team) => [team.id, team]))
  const users = session?.role === 'admin' && privateUsersState.uid === session.uid
    ? privateUsersState.users
    : []
  const auditLogs = session?.role === 'admin' && privateAuditState.uid === session.uid
    ? privateAuditState.entries
    : []
  const authorizedPrivateEvaluations = (session?.role === 'admin' || (session?.role === 'collaborator' && session.stationIds.includes('caribe')))
    && privateEvaluationsState.uid === session?.uid
    ? privateEvaluationsState.snapshot.items
    : []
  const evaluationByTeam = new Map(authorizedPrivateEvaluations.map((evaluation) => [evaluation.teamId, evaluation]))
  const evaluations = evaluationsSnapshot.items.map((evaluation) => evaluationByTeam.get(evaluation.teamId) ?? evaluation)
  for (const evaluation of authorizedPrivateEvaluations) {
    if (!evaluationsSnapshot.items.some((publicEvaluation) => publicEvaluation.teamId === evaluation.teamId)) {
      evaluations.push(evaluation)
    }
  }
  const teams = teamsSnapshot.items.map((team) => ({
    ...team,
    participants: privateTeams.get(team.id)?.participants ?? [],
  }))

  return {
    configured: isFirebaseConfigured,
    teams,
    matches: matchesSnapshot.items,
    evaluations,
    stations,
    scoringRules,
    users,
    auditLogs,
    session,
    authLoading,
    hasServerSnapshot,
    error,
    fromCache: teamsSnapshot.fromCache || matchesSnapshot.fromCache || evaluationsSnapshot.fromCache || authorizedPrivateSnapshot.fromCache || privateEvaluationsState.snapshot.fromCache,
    hasPendingWrites: teamsSnapshot.hasPendingWrites || matchesSnapshot.hasPendingWrites || evaluationsSnapshot.hasPendingWrites || authorizedPrivateSnapshot.hasPendingWrites || privateEvaluationsState.snapshot.hasPendingWrites,
  }
}
