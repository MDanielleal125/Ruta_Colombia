import type { Match } from './types'

export const EXPECTED_TEAM_COUNT = 14
export const COMPETITIVE_STATION_COUNT = 7

export function generateSchedule(teamIds: string[], stationIds: string[]): Match[] {
  if (teamIds.length !== EXPECTED_TEAM_COUNT) {
    throw new Error(`Se requieren exactamente ${EXPECTED_TEAM_COUNT} equipos activos.`)
  }
  if (new Set(teamIds).size !== teamIds.length || teamIds.some((id) => !id.trim())) {
    throw new Error('Los identificadores de los equipos deben ser únicos y no vacíos.')
  }
  if (stationIds.length !== COMPETITIVE_STATION_COUNT || new Set(stationIds).size !== stationIds.length) {
    throw new Error(`Se requieren exactamente ${COMPETITIVE_STATION_COUNT} estaciones competitivas distintas.`)
  }
  if (stationIds.includes('caribe')) {
    throw new Error('Caribe es colectiva y no puede contener enfrentamientos.')
  }

  const rotating = [...teamIds]
  const rounds: Array<Array<[string, string]>> = []

  for (let round = 0; round < COMPETITIVE_STATION_COUNT; round += 1) {
    const roundMatches: Array<[string, string]> = []
    for (let index = 0; index < EXPECTED_TEAM_COUNT / 2; index += 1) {
      roundMatches.push([rotating[index], rotating[EXPECTED_TEAM_COUNT - 1 - index]])
    }
    rounds.push(roundMatches)
    rotating.splice(1, 0, rotating.pop()!)
  }

  return stationIds.flatMap((stationId, stationIndex) =>
    rounds[stationIndex].map(([teamAId, teamBId], matchIndex) => ({
      id: `${stationId}-r${stationIndex + 1}-m${matchIndex + 1}`,
      stationId,
      teamAId,
      teamBId,
      status: 'pending',
      winnerTeamId: null,
    })),
  )
}

export function validateSchedule(matches: Match[], teamIds: string[], stationIds: string[]): string[] {
  const errors: string[] = []
  if (matches.length !== COMPETITIVE_STATION_COUNT * (EXPECTED_TEAM_COUNT / 2)) {
    errors.push('El calendario debe contener exactamente 49 enfrentamientos.')
  }
  if (matches.some((match) => match.stationId === 'caribe')) {
    errors.push('Caribe no debe tener enfrentamientos.')
  }
  const opponents = new Set<string>()
  for (const stationId of stationIds) {
    const stationMatches = matches.filter((match) => match.stationId === stationId)
    if (stationMatches.length !== EXPECTED_TEAM_COUNT / 2) {
      errors.push(`${stationId} debe tener siete enfrentamientos.`)
    }
    const appearances = stationMatches.flatMap((match) => [match.teamAId, match.teamBId])
    if (appearances.length !== EXPECTED_TEAM_COUNT || new Set(appearances).size !== EXPECTED_TEAM_COUNT) {
      errors.push(`Cada equipo debe aparecer una vez en ${stationId}.`)
    }
    for (const match of stationMatches) {
      if (match.teamAId === match.teamBId || !teamIds.includes(match.teamAId) || !teamIds.includes(match.teamBId)) {
        errors.push(`Enfrentamiento inválido en ${stationId}.`)
      }
      const pair = [match.teamAId, match.teamBId].sort().join(':')
      if (opponents.has(pair)) errors.push(`Pareja repetida: ${pair}.`)
      opponents.add(pair)
    }
  }
  return errors
}
