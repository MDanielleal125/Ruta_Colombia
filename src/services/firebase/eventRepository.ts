import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore'
import { DEFAULT_SCORING_RULES, type AuditEntry, type CaribeEvaluation, type EventUser, type Match, type ScoringRules, type StationGuide, type Team } from '../../domain/types'
import { db } from './firestoreClient'
import { STATIONS } from '../../domain/stations'

export interface LiveSnapshot<T> {
  items: T[]
  fromCache: boolean
  hasPendingWrites: boolean
}

function subscribe<T>(
  collectionName: string,
  mapDocument: (id: string, data: DocumentData) => T | null,
  onChange: (snapshot: LiveSnapshot<T>) => void,
  onError: (error: Error) => void,
): () => void {
  if (!db) return () => undefined
  return onSnapshot(collection(db, collectionName), { includeMetadataChanges: true }, (snapshot) => {
    onChange({
      items: snapshot.docs
        .map((document) => mapDocument(document.id, document.data()))
        .filter((item): item is T => item !== null),
      fromCache: snapshot.metadata.fromCache,
      hasPendingWrites: snapshot.metadata.hasPendingWrites,
    })
  }, onError)
}

export function subscribeTeams(onChange: (snapshot: LiveSnapshot<Team>) => void, onError: (error: Error) => void) {
  return subscribe<Team>('publicTeams', (id, data) => ({
    id,
    name: String(data.name ?? ''),
    color: String(data.color ?? '#164e63'),
    participants: [],
    complete: data.complete === true,
    active: data.active !== false,
  }), onChange, onError)
}

export function subscribePrivateTeams(onChange: (snapshot: LiveSnapshot<Team>) => void, onError: (error: Error) => void) {
  return subscribe<Team>('teams', (id, data) => ({
    id,
    name: String(data.name ?? ''),
    color: String(data.color ?? '#164e63'),
    participants: Array.isArray(data.participants) ? data.participants : [],
    complete: data.complete === true,
    active: data.active !== false,
  }), onChange, onError)
}

export function subscribeMatches(onChange: (snapshot: LiveSnapshot<Match>) => void, onError: (error: Error) => void) {
  return subscribe<Match>('matches', (id, data) => ({
    id,
    stationId: String(data.stationId ?? ''),
    teamAId: String(data.teamAId ?? ''),
    teamBId: String(data.teamBId ?? ''),
    status: data.status === 'confirmed' ? 'confirmed' : 'pending',
    winnerTeamId: typeof data.winnerTeamId === 'string' ? data.winnerTeamId : null,
    pointsA: typeof data.pointsA === 'number' ? data.pointsA : undefined,
    pointsB: typeof data.pointsB === 'number' ? data.pointsB : undefined,
    confirmedBy: typeof data.confirmedBy === 'string' ? data.confirmedBy : undefined,
    confirmedAt: typeof data.confirmedAt === 'string' ? data.confirmedAt : undefined,
  }), onChange, onError)
}

export function subscribeEvaluations(
  onChange: (snapshot: LiveSnapshot<CaribeEvaluation>) => void,
  onError: (error: Error) => void,
) {
  return subscribe<CaribeEvaluation>('publicCaribeEvaluations', (id, data) => ({
    id,
    teamId: String(data.teamId ?? ''),
    criteriaScores: {},
    evaluators: [],
    consolidatedScore: Number(data.consolidatedScore ?? 0),
    points: Number(data.points ?? 0),
    status: data.status === 'confirmed' ? 'confirmed' : 'pending',
    observations: String(data.observations ?? ''),
  }), onChange, onError)
}

export function subscribePrivateEvaluations(
  onChange: (snapshot: LiveSnapshot<CaribeEvaluation>) => void,
  onError: (error: Error) => void,
) {
  return subscribe<CaribeEvaluation>('caribeEvaluations', (id, data) => ({
    id,
    teamId: String(data.teamId ?? id),
    criteriaScores: data.criteriaScores && typeof data.criteriaScores === 'object' ? data.criteriaScores : {},
    evaluators: Array.isArray(data.evaluators) ? data.evaluators.filter((value): value is string => typeof value === 'string') : [],
    consolidatedScore: typeof data.consolidatedScore === 'number' ? data.consolidatedScore : 0,
    points: typeof data.points === 'number' ? data.points : 0,
    status: data.status === 'confirmed' ? 'confirmed' : 'pending',
    observations: String(data.observations ?? ''),
  }), onChange, onError)
}

export function subscribeStations(onChange: (stations: StationGuide[]) => void, onError: (error: Error) => void): () => void {
  const fallback = new Map(STATIONS.map((station) => [station.id, station]))
  return subscribe<StationGuide>('stations', (id, data) => {
    const base = fallback.get(id)
    if (!base) return null
    const asStringArray = (value: unknown, original: string[]) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : original
    return {
      ...base,
      ...data,
      id,
      region: base.region,
      game: base.game,
      activityType: base.activityType,
      materials: asStringArray(data.materials, base.materials),
      preparation: asStringArray(data.preparation, base.preparation),
      instructions: asStringArray(data.instructions, base.instructions),
      rules: asStringArray(data.rules, base.rules),
      penalties: asStringArray(data.penalties, base.penalties),
      specialCases: asStringArray(data.specialCases, base.specialCases),
      safety: asStringArray(data.safety, base.safety),
      organizerNotes: asStringArray(data.organizerNotes, base.organizerNotes),
      criteria: asStringArray(data.criteria, base.criteria ?? []),
    }
  }, (snapshot) => {
    const saved = new Map(snapshot.items.filter(Boolean).map((station) => [station.id, station]))
    onChange(STATIONS.map((station) => saved.get(station.id) ?? station))
  }, onError)
}

export function subscribeScoringRules(
  onChange: (rules: ScoringRules) => void,
  onError: (error: Error) => void,
): () => void {
  if (!db) return () => undefined
  return onSnapshot(doc(db, 'scoringRules', 'default'), (snapshot) => {
    const rules = snapshot.data()?.rules
    const value = typeof rules === 'object' && rules ? rules as Partial<ScoringRules> : {}
    onChange({
      win: typeof value.win === 'number' ? value.win : DEFAULT_SCORING_RULES.win,
      draw: typeof value.draw === 'number' ? value.draw : DEFAULT_SCORING_RULES.draw,
      loss: typeof value.loss === 'number' ? value.loss : DEFAULT_SCORING_RULES.loss,
      caribeMinimum: typeof value.caribeMinimum === 'number' ? value.caribeMinimum : DEFAULT_SCORING_RULES.caribeMinimum,
      caribeMaximum: typeof value.caribeMaximum === 'number' ? value.caribeMaximum : DEFAULT_SCORING_RULES.caribeMaximum,
      caribeScaleMaximum: typeof value.caribeScaleMaximum === 'number' ? value.caribeScaleMaximum : DEFAULT_SCORING_RULES.caribeScaleMaximum,
      caribeConsolidation: value.caribeConsolidation === 'average' ? 'average' : 'weighted-average',
      caribeCriteriaWeights: value.caribeCriteriaWeights && typeof value.caribeCriteriaWeights === 'object'
        ? Object.fromEntries(Object.entries(value.caribeCriteriaWeights).filter((entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0))
        : DEFAULT_SCORING_RULES.caribeCriteriaWeights,
    })
  }, onError)
}

export function subscribeUsers(onChange: (users: EventUser[]) => void, onError: (error: Error) => void): () => void {
  return subscribe<EventUser>('users', (id, data) => ({
    uid: id,
    name: String(data.name ?? 'Usuario'),
    email: String(data.email ?? ''),
    role: data.role === 'admin' || data.role === 'collaborator' || data.role === 'participant' ? data.role : null,
    stationIds: Array.isArray(data.stationIds) ? data.stationIds.filter((value): value is string => typeof value === 'string') : [],
    active: data.active !== false,
  }), (snapshot) => onChange(snapshot.items), onError)
}

export function subscribeAuditLogs(onChange: (entries: AuditEntry[]) => void, onError: (error: Error) => void): () => void {
  if (!db) return () => undefined
  const recentAudit = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50))
  return onSnapshot(recentAudit, (snapshot) => {
    onChange(snapshot.docs.map((document) => {
      const data = document.data()
      const timestamp = data.createdAt
      return {
        id: document.id,
        actorUid: String(data.actorUid ?? ''),
        action: String(data.action ?? ''),
        entity: String(data.entity ?? ''),
        entityId: String(data.entityId ?? ''),
        createdAt: timestamp && typeof timestamp.toDate === 'function'
          ? timestamp.toDate().toISOString()
          : '',
      }
    }))
  }, onError)
}

async function callFunction<TRequest, TResponse>(name: string, input: TRequest): Promise<TResponse> {
  const [{ httpsCallable }, { functions }] = await Promise.all([
    import('firebase/functions'),
    import('./functionsClient'),
  ])
  if (!functions) throw new Error('Firebase Functions no está configurado.')
  const callable = httpsCallable<TRequest, TResponse>(functions, name)
  const response = await callable(input)
  return response.data
}

export async function confirmMatchResult(matchId: string, winnerTeamId: string | 'draw'): Promise<void> {
  await callFunction('confirmMatchResult', { matchId, winnerTeamId })
}

export async function correctMatchResult(matchId: string, winnerTeamId: string | 'draw'): Promise<void> {
  await callFunction('correctMatchResult', { matchId, winnerTeamId })
}

export async function createSchedule(): Promise<void> {
  await callFunction<Record<string, never>, void>('generateEventSchedule', {})
}

export async function saveTeam(team: Omit<Team, 'id'> & { id?: string }, allowDuplicateParticipants = false): Promise<void> {
  await callFunction('saveTeam', { ...team, allowDuplicateParticipants })
}

export async function saveCaribeEvaluation(input: {
  teamId: string
  criteriaScores: Record<string, number>
  evaluators: string[]
  observations: string
}): Promise<void> {
  await callFunction('saveCaribeEvaluation', input)
}

export async function saveCaribeDraft(input: {
  teamId: string
  criteriaScores: Record<string, number>
  evaluators: string[]
  observations: string
}): Promise<void> {
  await callFunction('saveCaribeDraft', input)
}

export async function correctCaribeEvaluation(input: {
  teamId: string
  criteriaScores: Record<string, number>
  observations: string
}): Promise<void> {
  await callFunction('correctCaribeEvaluation', input)
}

export async function saveStationGuide(guide: StationGuide): Promise<void> {
  await callFunction<StationGuide, void>('saveStationGuide', guide)
}

export async function saveScoringRules(rules: ScoringRules): Promise<void> {
  await callFunction<ScoringRules, void>('saveScoringRules', rules)
}

export async function setUserAccess(input: {
  uid: string
  role: Exclude<EventUser['role'], null>
  stationIds: string[]
  active: boolean
}): Promise<void> {
  await callFunction('setUserAccess', input)
}
