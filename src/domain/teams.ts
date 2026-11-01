import type { Team } from './types'

export function validateTeam(
  candidate: Team,
  existingTeams: Team[],
  allowDuplicateParticipants = false,
): string[] {
  const errors: string[] = []
  const name = candidate.name.trim().toLocaleLowerCase()
  if (!name) errors.push('El equipo debe tener un nombre.')
  if (existingTeams.some((team) => team.id !== candidate.id && team.name.trim().toLocaleLowerCase() === name)) {
    errors.push('Ya existe un equipo con ese nombre.')
  }
  if (candidate.participants.length > 6) errors.push('Un equipo no puede tener más de seis participantes.')
  if (candidate.complete && candidate.participants.length !== 6) {
    errors.push('Un equipo completo debe tener exactamente seis participantes.')
  }
  const names = candidate.participants.map((participant) => participant.name.trim().toLocaleLowerCase())
  if (names.some((participantName) => !participantName)) errors.push('Cada participante debe tener un nombre.')
  if (new Set(names).size !== names.length) errors.push('No se puede repetir un participante dentro del mismo equipo.')
  if (!allowDuplicateParticipants) {
    const otherNames = new Set(existingTeams
      .filter((team) => team.id !== candidate.id)
      .flatMap((team) => team.participants.map((participant) => participant.name.trim().toLocaleLowerCase())))
    if (names.some((participantName) => otherNames.has(participantName))) {
      errors.push('Un participante ya está asignado a otro equipo.')
    }
  }
  if (!/^#[0-9a-f]{6}$/i.test(candidate.color)) errors.push('El color debe estar en formato hexadecimal de seis dígitos.')
  return errors
}
