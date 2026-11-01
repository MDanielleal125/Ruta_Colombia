import { describe, expect, it } from 'vitest'
import { COMPETITIVE_STATION_IDS } from './stations'
import { generateSchedule, validateSchedule } from './scheduling'

const teams = Array.from({ length: 14 }, (_, index) => `team-${index + 1}`)

describe('generateSchedule', () => {
  it('creates exactly 49 unique pairings with one appearance per team and station', () => {
    const matches = generateSchedule(teams, COMPETITIVE_STATION_IDS)
    expect(matches).toHaveLength(49)
    expect(validateSchedule(matches, teams, COMPETITIVE_STATION_IDS)).toEqual([])

    for (const stationId of COMPETITIVE_STATION_IDS) {
      const stationMatches = matches.filter((match) => match.stationId === stationId)
      expect(stationMatches).toHaveLength(7)
      expect(new Set(stationMatches.flatMap((match) => [match.teamAId, match.teamBId])).size).toBe(14)
    }

    const pairings = matches.map((match) => [match.teamAId, match.teamBId].sort().join(':'))
    expect(new Set(pairings).size).toBe(49)
    expect(matches.some((match) => match.stationId === 'caribe')).toBe(false)
  })

  it('rejects invalid team or station counts and collective Caribe', () => {
    expect(() => generateSchedule(teams.slice(1), COMPETITIVE_STATION_IDS)).toThrow(/14 equipos/)
    expect(() => generateSchedule(teams, COMPETITIVE_STATION_IDS.slice(1))).toThrow(/7 estaciones/)
    expect(() => generateSchedule(teams, [...COMPETITIVE_STATION_IDS.slice(1), 'caribe'])).toThrow(/Caribe/)
  })
})
