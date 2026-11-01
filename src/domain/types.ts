export type UserRole = 'admin' | 'collaborator' | 'participant'
export type ActivityType = 'collective' | 'competitive'
export type MatchStatus = 'pending' | 'confirmed'

export interface Participant {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  color: string
  participants: Participant[]
  complete: boolean
  active: boolean
}

export interface StationGuide {
  id: string
  region: string
  game: string
  activityType: ActivityType
  summary: string
  context: string
  objective: string
  materials: string[]
  preparation: string[]
  instructions: string[]
  rules: string[]
  penalties: string[]
  specialCases: string[]
  safety: string[]
  estimatedMinutes: number | null
  organizerNotes: string[]
  criteria?: string[]
}

export interface Match {
  id: string
  stationId: string
  teamAId: string
  teamBId: string
  status: MatchStatus
  winnerTeamId: string | null
  pointsA?: number
  pointsB?: number
  confirmedBy?: string
  confirmedAt?: string
}

export interface CaribeEvaluation {
  id: string
  teamId: string
  criteriaScores: Record<string, number>
  evaluators: string[]
  consolidatedScore: number
  points: number
  status: MatchStatus
  observations: string
}

export interface ScoringRules {
  win: number
  draw: number
  loss: number
  caribeMinimum: number
  caribeMaximum: number
  caribeScaleMaximum: number
  caribeConsolidation: 'average' | 'weighted-average'
  caribeCriteriaWeights: Record<string, number>
}

export interface EventUser {
  uid: string
  name: string
  email: string
  role: UserRole | null
  stationIds: string[]
  active: boolean
}

export interface AuditEntry {
  id: string
  actorUid: string
  action: string
  entity: string
  entityId: string
  createdAt: string
}

export interface TeamStanding {
  team: Team
  totalPoints: number
  competitivePoints: number
  caribePoints: number
  wins: number
  draws: number
  losses: number
  completedStations: number
  pointsByStation: Record<string, number>
  rank: number
  tied: boolean
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  win: 16,
  draw: 13,
  loss: 11,
  caribeMinimum: 11,
  caribeMaximum: 16,
  caribeScaleMaximum: 100,
  caribeConsolidation: 'weighted-average',
  caribeCriteriaWeights: {
    'Ritmo y seguimiento musical': 1,
    'Coordinación grupal': 1,
    'Energía y expresión corporal': 1,
    'Creatividad y participación': 1,
  },
}
