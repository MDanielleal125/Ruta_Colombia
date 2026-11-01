import { describe, expect, it } from 'vitest'
import { validateTeam } from './teams'
import type { Team } from './types'

function makeTeam(id: string, name: string, participantNames: string[], complete = true): Team {
  return {
    id,
    name,
    color: '#123456',
    participants: participantNames.map((participantName, index) => ({ id: `${id}-${index}`, name: participantName })),
    complete,
    active: true,
  }
}

describe('validateTeam', () => {
  it('accepts a complete team with six participants', () => {
    const team = makeTeam('one', 'Equipo Uno', ['Ana', 'Beto', 'Cami', 'Dani', 'Eli', 'Fer'])
    expect(validateTeam(team, [])).toEqual([])
  })

  it('rejects incomplete completed teams, duplicate names, and repeated participants', () => {
    const team = makeTeam('one', 'Equipo Uno', ['Ana', 'Beto'], true)
    const existing = [makeTeam('two', 'Equipo Uno', ['Ana', 'Beto', 'Cami', 'Dani', 'Eli', 'Fer'])]
    const errors = validateTeam(team, existing)
    expect(errors).toContain('Un equipo completo debe tener exactamente seis participantes.')
    expect(errors).toContain('Ya existe un equipo con ese nombre.')
    expect(errors).toContain('Un participante ya está asignado a otro equipo.')
  })

  it('allows an explicit participant-duplication exception but never more than six', () => {
    const team = makeTeam('one', 'Equipo Uno', ['Ana', 'Beto', 'Cami', 'Dani', 'Eli', 'Fer', 'Gus'], false)
    const existing = [makeTeam('two', 'Equipo Dos', ['Ana', 'Beto', 'Cami', 'Dani', 'Eli', 'Fer'])]
    const errors = validateTeam(team, existing, true)
    expect(errors).toContain('Un equipo no puede tener más de seis participantes.')
    expect(errors).not.toContain('Un participante ya está asignado a otro equipo.')
  })
})
