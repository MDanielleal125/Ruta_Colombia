import type { CaribeEvaluation, Match, StationGuide, Team, TeamStanding } from '../domain/types'
import { STATIONS } from '../domain/stations'
import type { Workbook, Worksheet } from 'exceljs'

export async function exportStandings(standings: TeamStanding[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ruta Colombia'
  workbook.created = new Date()
  addStandingsSheet(workbook, standings)
  await downloadWorkbook(workbook, 'ruta-colombia-clasificacion.xlsx')
}

export async function exportEventReport(input: {
  standings: TeamStanding[]
  teams: Team[]
  matches: Match[]
  evaluations: CaribeEvaluation[]
  stations: StationGuide[]
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ruta Colombia'
  workbook.created = new Date()
  addStandingsSheet(workbook, input.standings)
  const teamById = new Map(input.teams.map((team) => [team.id, team]))
  const stationById = new Map(input.stations.map((station) => [station.id, station]))
  const matchesSheet = workbook.addWorksheet('Enfrentamientos')
  matchesSheet.columns = [
    { header: 'ID', key: 'id', width: 28 },
    { header: 'Estación', key: 'station', width: 20 },
    { header: 'Equipo A', key: 'teamA', width: 24 },
    { header: 'Equipo B', key: 'teamB', width: 24 },
    { header: 'Resultado', key: 'winner', width: 24 },
    { header: 'Puntos A', key: 'pointsA', width: 12 },
    { header: 'Puntos B', key: 'pointsB', width: 12 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Confirmado por UID', key: 'confirmedBy', width: 30 },
    { header: 'Fecha de confirmación', key: 'confirmedAt', width: 24 },
  ]
  styleHeader(matchesSheet)
  for (const match of input.matches) {
    matchesSheet.addRow({
      id: match.id,
      station: stationById.get(match.stationId)?.region ?? match.stationId,
      teamA: teamById.get(match.teamAId)?.name ?? match.teamAId,
      teamB: teamById.get(match.teamBId)?.name ?? match.teamBId,
      winner: match.winnerTeamId === 'draw'
        ? 'Empate'
        : match.winnerTeamId ? teamById.get(match.winnerTeamId)?.name ?? match.winnerTeamId : '',
      pointsA: match.pointsA ?? '',
      pointsB: match.pointsB ?? '',
      status: match.status === 'confirmed' ? 'Confirmado' : 'Pendiente',
      confirmedBy: match.confirmedBy ?? '',
      confirmedAt: match.confirmedAt ?? '',
    })
  }

  const caribeSheet = workbook.addWorksheet('Evaluaciones Caribe')
  const criteria = input.stations.find((station) => station.id === 'caribe')?.criteria ?? []
  caribeSheet.columns = [
    { header: 'Equipo', key: 'team', width: 24 },
    ...criteria.map((criterion, index) => ({ header: criterion, key: `criterion${index}`, width: 24 })),
    { header: 'Calificación consolidada', key: 'score', width: 24 },
    { header: 'Puntos Caribe', key: 'points', width: 16 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Evaluadores UID', key: 'evaluators', width: 28 },
    { header: 'Observaciones', key: 'observations', width: 48 },
  ]
  styleHeader(caribeSheet)
  for (const evaluation of input.evaluations) {
    const row: Record<string, string | number> = {
      team: teamById.get(evaluation.teamId)?.name ?? evaluation.teamId,
      score: evaluation.consolidatedScore,
      points: evaluation.points,
      status: evaluation.status === 'confirmed' ? 'Confirmado' : 'Borrador',
      evaluators: evaluation.evaluators.join(', '),
      observations: evaluation.observations,
    }
    criteria.forEach((criterion, index) => { row[`criterion${index}`] = evaluation.criteriaScores[criterion] ?? '' })
    caribeSheet.addRow(row)
  }

  const participantSheet = workbook.addWorksheet('Participantes')
  participantSheet.columns = [
    { header: 'Equipo', key: 'team', width: 28 },
    { header: 'Color', key: 'color', width: 14 },
    { header: 'Participante', key: 'participant', width: 34 },
    { header: 'Estado del equipo', key: 'status', width: 18 },
  ]
  styleHeader(participantSheet)
  for (const team of input.teams) {
    if (team.participants.length === 0) {
      participantSheet.addRow({ team: team.name, color: team.color, participant: '', status: team.complete ? 'Completo' : 'Incompleto' })
      continue
    }
    for (const participant of team.participants) {
      participantSheet.addRow({ team: team.name, color: team.color, participant: participant.name, status: team.complete ? 'Completo' : 'Incompleto' })
    }
  }
  await downloadWorkbook(workbook, 'ruta-colombia-reporte-general.xlsx')
}

function addStandingsSheet(workbook: Workbook, standings: TeamStanding[]) {
  const sheet = workbook.addWorksheet('Clasificación')
  sheet.columns = [
    { header: 'Posición', key: 'rank', width: 12 },
    { header: 'Equipo', key: 'team', width: 26 },
    { header: 'Puntos totales', key: 'total', width: 16 },
    { header: 'Competitivas', key: 'competitive', width: 16 },
    { header: 'Caribe', key: 'caribe', width: 12 },
    { header: 'Victorias', key: 'wins', width: 12 },
    { header: 'Empates', key: 'draws', width: 12 },
    { header: 'Derrotas', key: 'losses', width: 12 },
    { header: 'Estaciones completadas', key: 'completed', width: 22 },
    ...STATIONS.map((station) => ({ header: station.region, key: station.id, width: 18 })),
  ]
  styleHeader(sheet)
  for (const standing of standings) {
    sheet.addRow({
      rank: standing.rank,
      team: standing.team.name,
      total: standing.totalPoints,
      competitive: standing.competitivePoints,
      caribe: standing.caribePoints,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      completed: standing.completedStations,
      ...standing.pointsByStation,
    })
  }
  return sheet
}

function styleHeader(sheet: Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13344B' } }
}

async function downloadWorkbook(workbook: Workbook, filename: string): Promise<void> {
  const bytes = await workbook.xlsx.writeBuffer()
  const file = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
