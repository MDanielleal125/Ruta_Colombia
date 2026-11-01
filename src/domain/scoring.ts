import {
  DEFAULT_SCORING_RULES,
  type CaribeEvaluation,
  type Match,
  type ScoringRules,
  type Team,
  type TeamStanding,
} from './types'

export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function caribePoints(score: number, rules: ScoringRules = DEFAULT_SCORING_RULES): number {
  if (!Number.isFinite(score) || score < 0 || score > rules.caribeScaleMaximum) {
    throw new Error(`La calificación debe estar entre 0 y ${rules.caribeScaleMaximum}.`)
  }
  const converted = rules.caribeMinimum
    + (rules.caribeMaximum - rules.caribeMinimum) * (score / rules.caribeScaleMaximum)
  return roundToTwoDecimals(converted)
}

export function consolidateCaribeScore(
  scores: Record<string, number>,
  criteria: string[],
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): number {
  if (criteria.length === 0 || criteria.some((criterion) => !Number.isFinite(scores[criterion]))) {
    throw new Error('La evaluación debe incluir una calificación válida para cada criterio.')
  }
  if (rules.caribeConsolidation === 'average') {
    return roundToTwoDecimals(criteria.reduce((sum, criterion) => sum + scores[criterion], 0) / criteria.length)
  }
  const weights = criteria.map((criterion) => rules.caribeCriteriaWeights[criterion] ?? 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0) || totalWeight <= 0) {
    throw new Error('Los pesos de evaluación configurados no son válidos.')
  }
  const weightedScore = criteria.reduce((sum, criterion, index) => sum + scores[criterion] * weights[index], 0)
  return roundToTwoDecimals(weightedScore / totalWeight)
}

export function calculateStandings(
  teams: Team[],
  matches: Match[],
  evaluations: CaribeEvaluation[],
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>()
  for (const team of teams) {
    standings.set(team.id, {
      team,
      totalPoints: 0,
      competitivePoints: 0,
      caribePoints: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      completedStations: 0,
      pointsByStation: {},
      rank: 0,
      tied: false,
    })
  }

  const directResults = new Map<string, number>()
  const confirmedByMatchId = new Set<string>()
  for (const match of matches) {
    if (match.status !== 'confirmed' || !match.winnerTeamId || confirmedByMatchId.has(match.id)) continue
    const teamA = standings.get(match.teamAId)
    const teamB = standings.get(match.teamBId)
    if (!teamA || !teamB) continue

    confirmedByMatchId.add(match.id)
    const isDraw = match.winnerTeamId === 'draw'
    const aWon = match.winnerTeamId === match.teamAId
    if (!isDraw && !aWon && match.winnerTeamId !== match.teamBId) continue
    const pointsA = isDraw ? rules.draw : aWon ? rules.win : rules.loss
    const pointsB = isDraw ? rules.draw : aWon ? rules.loss : rules.win
    teamA.competitivePoints += pointsA
    teamB.competitivePoints += pointsB
    teamA.pointsByStation[match.stationId] = (teamA.pointsByStation[match.stationId] ?? 0) + pointsA
    teamB.pointsByStation[match.stationId] = (teamB.pointsByStation[match.stationId] ?? 0) + pointsB
    teamA.completedStations += 1
    teamB.completedStations += 1
    if (isDraw) {
      teamA.draws += 1
      teamB.draws += 1
    } else {
      const winner = aWon ? teamA : teamB
      const loser = aWon ? teamB : teamA
      winner.wins += 1
      loser.losses += 1
      directResults.set(`${winner.team.id}:${loser.team.id}`, 1)
    }
  }

  const evaluatedTeams = new Set<string>()
  for (const evaluation of evaluations) {
    if (evaluation.status !== 'confirmed' || evaluatedTeams.has(evaluation.teamId)) continue
    const standing = standings.get(evaluation.teamId)
    if (!standing) continue
    const points = caribePoints(evaluation.consolidatedScore, rules)
    standing.caribePoints = points
    standing.pointsByStation.caribe = points
    standing.completedStations += 1
    evaluatedTeams.add(evaluation.teamId)
  }

  const ordered = [...standings.values()]
  for (const standing of ordered) {
    standing.totalPoints = roundToTwoDecimals(standing.competitivePoints + standing.caribePoints)
  }
  ordered.sort((a, b) =>
    b.totalPoints - a.totalPoints
    || b.wins - a.wins
    || b.caribePoints - a.caribePoints
    || (directResults.get(`${b.team.id}:${a.team.id}`) ?? 0) - (directResults.get(`${a.team.id}:${b.team.id}`) ?? 0)
    || a.team.name.localeCompare(b.team.name),
  )
  ordered.forEach((standing, index) => {
    const previous = ordered[index - 1]
    standing.rank = previous && hasSameRankingCriteria(previous, standing, directResults)
      ? previous.rank
      : index + 1
    standing.tied = Boolean(previous && standing.rank === previous.rank)
  })
  return ordered
}

function hasSameRankingCriteria(
  a: TeamStanding,
  b: TeamStanding,
  directResults: Map<string, number>,
): boolean {
  return a.totalPoints === b.totalPoints
    && a.wins === b.wins
    && a.caribePoints === b.caribePoints
    && (directResults.get(`${a.team.id}:${b.team.id}`) ?? 0)
      === (directResults.get(`${b.team.id}:${a.team.id}`) ?? 0)
}
