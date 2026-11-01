import type { Team } from '../domain/types'
import type { EventUser, ScoringRules, StationGuide } from '../domain/types'

export async function signIn(email: string, password: string): Promise<void> {
  const service = await import('./firebase/auth')
  return service.signIn(email, password)
}

export async function signOutUser(): Promise<void> {
  const service = await import('./firebase/auth')
  return service.signOutUser()
}

export async function confirmMatchResult(matchId: string, winnerTeamId: string | 'draw'): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.confirmMatchResult(matchId, winnerTeamId)
}

export async function correctMatchResult(matchId: string, winnerTeamId: string | 'draw'): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.correctMatchResult(matchId, winnerTeamId)
}

export async function createSchedule(): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.createSchedule()
}

export async function saveTeam(team: Omit<Team, 'id'> & { id?: string }, allowDuplicateParticipants = false): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.saveTeam(team, allowDuplicateParticipants)
}

export async function saveCaribeEvaluation(input: {
  teamId: string
  criteriaScores: Record<string, number>
  evaluators: string[]
  observations: string
}): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.saveCaribeEvaluation(input)
}

export async function saveCaribeDraft(input: {
  teamId: string
  criteriaScores: Record<string, number>
  evaluators: string[]
  observations: string
}): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.saveCaribeDraft(input)
}

export async function correctCaribeEvaluation(input: {
  teamId: string
  criteriaScores: Record<string, number>
  observations: string
}): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.correctCaribeEvaluation(input)
}

export async function saveStationGuide(guide: StationGuide): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.saveStationGuide(guide)
}

export async function saveScoringRules(rules: ScoringRules): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.saveScoringRules(rules)
}

export async function setUserAccess(input: {
  uid: string
  role: Exclude<EventUser['role'], null>
  stationIds: string[]
  active: boolean
}): Promise<void> {
  const service = await import('./firebase/eventRepository')
  return service.setUserAccess(input)
}
