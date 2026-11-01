import { describe, expect, it } from 'vitest'
import { calculateStandings, caribePoints, consolidateCaribeScore } from './scoring'
import { DEFAULT_SCORING_RULES, type CaribeEvaluation, type Match, type Team } from './types'

const teams: Team[] = ['A', 'B', 'C'].map((name) => ({
  id: name,
  name: `Equipo ${name}`,
  color: '#123456',
  participants: [],
  complete: false,
  active: true,
}))

const match = (id: string, stationId: string, teamAId: string, teamBId: string, winnerTeamId: string, status = 'confirmed'): Match => ({
  id,
  stationId,
  teamAId,
  teamBId,
  status: status as Match['status'],
  winnerTeamId,
})

const evaluation = (teamId: string, score: number, status: 'pending' | 'confirmed' = 'confirmed'): CaribeEvaluation => ({
  id: teamId,
  teamId,
  criteriaScores: {},
  evaluators: [],
  consolidatedScore: score,
  points: 0,
  status,
  observations: '',
})

describe('scoring', () => {
  it('converts Caribe scores across the configured 11–16 range', () => {
    expect(caribePoints(0)).toBe(11)
    expect(caribePoints(50)).toBe(13.5)
    expect(caribePoints(100)).toBe(16)
    expect(() => caribePoints(101)).toThrow(/entre 0 y 100/)
  })

  it('consolidates Caribe scores with either an average or configured weights', () => {
    const scores = { Ritmo: 20, Coordinación: 100 }
    const rules = {
      ...DEFAULT_SCORING_RULES,
      caribeCriteriaWeights: { Ritmo: 1, Coordinación: 3 },
    }
    expect(consolidateCaribeScore(scores, Object.keys(scores), rules)).toBe(80)
    expect(consolidateCaribeScore(scores, Object.keys(scores), { ...rules, caribeConsolidation: 'average' })).toBe(60)
    expect(() => consolidateCaribeScore(scores, [], rules)).toThrow(/criterio/)
    expect(() => consolidateCaribeScore(scores, Object.keys(scores), {
      ...rules,
      caribeCriteriaWeights: { Ritmo: 0, Coordinación: 0 },
    })).toThrow(/pesos/)
  })

  it('calculates win/draw/loss points and excludes pending results', () => {
    const results = [
      match('m1', 'pacifico', 'A', 'B', 'A'),
      match('m2', 'amazonia', 'A', 'C', 'draw'),
      match('m3', 'llanos', 'B', 'C', 'C'),
      match('m4', 'eje-cafetero', 'B', 'A', 'B', 'pending'),
    ]
    const standings = calculateStandings(teams, results, [evaluation('A', 100), evaluation('B', 0)])
    const byId = new Map(standings.map((standing) => [standing.team.id, standing]))
    expect(byId.get('A')?.competitivePoints).toBe(29)
    expect(byId.get('B')?.competitivePoints).toBe(22)
    expect(byId.get('C')?.competitivePoints).toBe(29)
    expect(byId.get('A')?.caribePoints).toBe(16)
    expect(byId.get('B')?.caribePoints).toBe(11)
    expect(byId.get('A')?.completedStations).toBe(3)
    expect(byId.get('B')?.completedStations).toBe(3)
  })

  it('does not count the same confirmed match or evaluation twice', () => {
    const duplicate = match('same', 'pacifico', 'A', 'B', 'A')
    const standings = calculateStandings(teams, [duplicate, duplicate], [evaluation('A', 50), evaluation('A', 50)])
    const teamA = standings.find((standing) => standing.team.id === 'A')
    expect(teamA?.competitivePoints).toBe(16)
    expect(teamA?.caribePoints).toBe(13.5)
    expect(teamA?.completedStations).toBe(2)
  })

  it('uses the stated tie-break order and preserves unresolved ties', () => {
    const standings = calculateStandings(
      teams.slice(0, 2),
      [match('m1', 'pacifico', 'A', 'B', 'draw')],
      [evaluation('A', 50), evaluation('B', 50)],
    )
    expect(standings[0].rank).toBe(1)
    expect(standings[1].rank).toBe(1)
    expect(standings[1].tied).toBe(true)
  })
})
