import { randomUUID } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import type { ScoringRules } from '../../src/domain/types.js'

if (getApps().length === 0) initializeApp()
const db = getFirestore()
const REGION = 'southamerica-east1'
const COMPETITIVE_STATIONS = ['pacifico', 'amazonia', 'llanos', 'eje-cafetero', 'santander', 'insular', 'andina']
const CARIBE_CRITERIA = [
  'Ritmo y seguimiento musical',
  'Coordinación grupal',
  'Energía y expresión corporal',
  'Creatividad y participación',
]
const STATION_IDENTITIES: Record<string, { region: string; game: string; activityType: 'collective' | 'competitive' }> = {
  caribe: { region: 'Caribe', game: 'Bailoterapia', activityType: 'collective' },
  pacifico: { region: 'Pacífico', game: 'Guardianes del Pacífico', activityType: 'competitive' },
  amazonia: { region: 'Amazonía', game: 'Nudo Amazónico', activityType: 'competitive' },
  llanos: { region: 'Llanos', game: 'Carrera del Llanero', activityType: 'competitive' },
  'eje-cafetero': { region: 'Eje Cafetero', game: 'La Gran Cosecha', activityType: 'competitive' },
  santander: { region: 'Santander', game: 'Desafío Santandereano', activityType: 'competitive' },
  insular: { region: 'Región Insular', game: 'Desafío de Equilibrio', activityType: 'competitive' },
  andina: { region: 'Región Andina', game: 'Tres en Raya', activityType: 'competitive' },
}
const DEFAULT_RULES: ScoringRules = {
  win: 16,
  draw: 13,
  loss: 11,
  caribeMinimum: 11,
  caribeMaximum: 16,
  caribeScaleMaximum: 100,
  caribeConsolidation: 'weighted-average',
  caribeCriteriaWeights: Object.fromEntries(CARIBE_CRITERIA.map((criterion) => [criterion, 1])),
}

interface Actor {
  uid: string
  role: 'admin' | 'collaborator' | 'participant' | null
  stationIds: string[]
  active: boolean
}

function assertSignedIn(uid: string | undefined): asserts uid is string {
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para realizar esta operación.')
}

async function actorInTransaction(transaction: Transaction, uid: string): Promise<Actor> {
  const profile = await transaction.get(db.doc(`users/${uid}`))
  const data = profile.data()
  const role = data?.role
  return {
    uid,
    role: role === 'admin' || role === 'collaborator' || role === 'participant' ? role : null,
    stationIds: Array.isArray(data?.stationIds) ? data.stationIds.filter((value): value is string => typeof value === 'string') : [],
    active: data?.active === true,
  }
}

function requireAdmin(actor: Actor): void {
  if (!actor.active || actor.role !== 'admin') throw new HttpsError('permission-denied', 'Esta operación requiere una cuenta administradora activa.')
}

function requireStationAccess(actor: Actor, stationId: string): void {
  if (!actor.active || (actor.role !== 'admin' && !(actor.role === 'collaborator' && actor.stationIds.includes(stationId)))) {
    throw new HttpsError('permission-denied', 'No tienes permisos para operar esta estación.')
  }
}

function scoringRules(data: DocumentData | undefined): ScoringRules {
  const configured = data?.rules
  const rules = {
    win: validScore(configured?.win, DEFAULT_RULES.win),
    draw: validScore(configured?.draw, DEFAULT_RULES.draw),
    loss: validScore(configured?.loss, DEFAULT_RULES.loss),
    caribeMinimum: validScore(configured?.caribeMinimum, DEFAULT_RULES.caribeMinimum),
    caribeMaximum: validScore(configured?.caribeMaximum, DEFAULT_RULES.caribeMaximum),
    caribeScaleMaximum: validScore(configured?.caribeScaleMaximum, DEFAULT_RULES.caribeScaleMaximum),
    caribeConsolidation: configured?.caribeConsolidation === undefined
      ? DEFAULT_RULES.caribeConsolidation
      : configured.caribeConsolidation,
    caribeCriteriaWeights: configured?.caribeCriteriaWeights === undefined
      ? DEFAULT_RULES.caribeCriteriaWeights
      : configured.caribeCriteriaWeights,
  }
  if (rules.win < rules.draw || rules.draw < rules.loss || rules.caribeMaximum < rules.caribeMinimum || rules.caribeScaleMaximum <= 0
    || (rules.caribeConsolidation !== 'average' && rules.caribeConsolidation !== 'weighted-average')
    || !rules.caribeCriteriaWeights || typeof rules.caribeCriteriaWeights !== 'object'
    || Array.isArray(rules.caribeCriteriaWeights)
    || Object.values(rules.caribeCriteriaWeights).some((weight: unknown) => typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)
    || Object.values(rules.caribeCriteriaWeights).every((weight) => weight === 0)) {
    throw new HttpsError('failed-precondition', 'La configuración de puntuación guardada no es válida.')
  }
  return rules as ScoringRules
}

function validScore(value: unknown, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpsError('failed-precondition', 'La configuración de puntuación guardada contiene un valor no numérico.')
  }
  return value
}

function consolidateCaribeScore(scores: Record<string, unknown>, criteria: string[], rules: ScoringRules): number {
  if (rules.caribeConsolidation === 'average') {
    return roundToTwoDecimals(criteria.reduce((sum, criterion) => sum + Number(scores[criterion]), 0) / criteria.length)
  }
  const weights = criteria.map((criterion) => rules.caribeCriteriaWeights[criterion] ?? 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) throw new HttpsError('failed-precondition', 'Los pesos de evaluación configurados no son válidos.')
  const total = criteria.reduce((sum, criterion, index) => sum + Number(scores[criterion]) * weights[index], 0)
  return roundToTwoDecimals(total / totalWeight)
}

function caribeCriteria(data: DocumentData | undefined): string[] {
  const criteria = data?.criteria
  return Array.isArray(criteria) && criteria.length > 0 && criteria.every((criterion) => typeof criterion === 'string')
    ? criteria
    : CARIBE_CRITERIA
}

function addAudit(transaction: Transaction, actor: Actor, action: string, entity: string, entityId: string, changes: DocumentData) {
  const auditRef = db.collection('auditLogs').doc()
  transaction.set(auditRef, {
    actorUid: actor.uid,
    action,
    entity,
    entityId,
    changes,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export const confirmMatchResult = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const matchId = request.data?.matchId
  const winnerTeamId = request.data?.winnerTeamId
  if (typeof matchId !== 'string' || !matchId || typeof winnerTeamId !== 'string') {
    throw new HttpsError('invalid-argument', 'Faltan datos válidos para confirmar el resultado.')
  }

  await db.runTransaction(async (transaction) => {
    const matchRef = db.doc(`matches/${matchId}`)
    const resultRef = db.doc(`results/${matchId}`)
    const profileRef = db.doc(`users/${uid}`)
    const [matchSnap, profileSnap, resultSnap] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(profileRef),
      transaction.get(resultRef),
    ])
    if (!matchSnap.exists) throw new HttpsError('not-found', 'No se encontró el enfrentamiento.')
    if (matchSnap.get('status') !== 'pending') throw new HttpsError('already-exists', 'El enfrentamiento ya fue confirmado.')
    if (resultSnap.exists) throw new HttpsError('already-exists', 'Este resultado ya fue registrado.')
    const stationId = matchSnap.get('stationId')
    const teamAId = matchSnap.get('teamAId')
    const teamBId = matchSnap.get('teamBId')
    if (typeof stationId !== 'string' || !COMPETITIVE_STATIONS.includes(stationId)) {
      throw new HttpsError('failed-precondition', 'El enfrentamiento no pertenece a una estación competitiva.')
    }
    if (winnerTeamId !== 'draw' && winnerTeamId !== teamAId && winnerTeamId !== teamBId) {
      throw new HttpsError('invalid-argument', 'El resultado debe ser una victoria de uno de los equipos o empate.')
    }
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireStationAccess(actor, stationId)
    const rulesSnap = await transaction.get(db.doc('scoringRules/default'))
    const rules = scoringRules(rulesSnap.data())
    const pointsA = winnerTeamId === 'draw' ? rules.draw : winnerTeamId === teamAId ? rules.win : rules.loss
    const pointsB = winnerTeamId === 'draw' ? rules.draw : winnerTeamId === teamAId ? rules.loss : rules.win
    const confirmedAt = FieldValue.serverTimestamp()
    const result = {
      matchId,
      stationId,
      teamAId,
      teamBId,
      winnerTeamId,
      pointsA,
      pointsB,
      status: 'confirmed',
      confirmedBy: actor.uid,
      confirmedAt,
    }
    transaction.update(matchRef, result)
    transaction.create(resultRef, result)
    addAudit(transaction, actor, 'confirm', 'match', matchId, { winnerTeamId, pointsA, pointsB })
  })
  return { confirmed: true }
})

export const correctMatchResult = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const matchId = request.data?.matchId
  const winnerTeamId = request.data?.winnerTeamId
  if (typeof matchId !== 'string' || !matchId || typeof winnerTeamId !== 'string') {
    throw new HttpsError('invalid-argument', 'Faltan datos válidos para corregir el resultado.')
  }
  await db.runTransaction(async (transaction) => {
    const matchRef = db.doc(`matches/${matchId}`)
    const resultRef = db.doc(`results/${matchId}`)
    const [matchSnap, resultSnap, profileSnap, rulesSnap] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(resultRef),
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.doc('scoringRules/default')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    if (!matchSnap.exists || !resultSnap.exists || matchSnap.get('status') !== 'confirmed') {
      throw new HttpsError('failed-precondition', 'Solo se pueden corregir resultados ya confirmados.')
    }
    const teamAId = matchSnap.get('teamAId')
    const teamBId = matchSnap.get('teamBId')
    if (winnerTeamId !== 'draw' && winnerTeamId !== teamAId && winnerTeamId !== teamBId) {
      throw new HttpsError('invalid-argument', 'El resultado no corresponde a los equipos del enfrentamiento.')
    }
    const rules = scoringRules(rulesSnap.data())
    const pointsA = winnerTeamId === 'draw' ? rules.draw : winnerTeamId === teamAId ? rules.win : rules.loss
    const pointsB = winnerTeamId === 'draw' ? rules.draw : winnerTeamId === teamAId ? rules.loss : rules.win
    const previous = {
      winnerTeamId: matchSnap.get('winnerTeamId'),
      pointsA: matchSnap.get('pointsA'),
      pointsB: matchSnap.get('pointsB'),
    }
    if (previous.winnerTeamId === winnerTeamId) throw new HttpsError('failed-precondition', 'El resultado seleccionado ya está registrado.')
    const correction = {
      winnerTeamId,
      pointsA,
      pointsB,
      correctedBy: uid,
      correctedAt: FieldValue.serverTimestamp(),
    }
    transaction.update(matchRef, correction)
    transaction.update(resultRef, correction)
    addAudit(transaction, actor, 'correct', 'match', matchId, { previous, next: correction })
  })
  return { corrected: true }
})

export const generateEventSchedule = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  await db.runTransaction(async (transaction) => {
    const teamsQuery = db.collection('teams').where('active', '==', true)
    const [profileSnap, teamsSnap, matchesSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(teamsQuery),
      transaction.get(db.collection('matches')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    if (teamsSnap.size !== 14 || teamsSnap.docs.some((team) => team.get('complete') !== true || !Array.isArray(team.get('participants')) || team.get('participants').length !== 6)) {
      throw new HttpsError('failed-precondition', 'Se requieren exactamente 14 equipos activos y completos.')
    }
    if (!matchesSnap.empty) throw new HttpsError('already-exists', 'La programación ya existe y no se puede regenerar.')

    const teamIds = teamsSnap.docs.map((team) => team.id).sort()
    const rotating = [...teamIds]
    const schedule: Array<{ stationId: string; round: number; index: number; teamAId: string; teamBId: string }> = []
    for (let round = 0; round < COMPETITIVE_STATIONS.length; round += 1) {
      for (let index = 0; index < 7; index += 1) {
        schedule.push({
          stationId: COMPETITIVE_STATIONS[round],
          round: round + 1,
          index: index + 1,
          teamAId: rotating[index],
          teamBId: rotating[13 - index],
        })
      }
      rotating.splice(1, 0, rotating.pop()!)
    }
    validateGeneratedSchedule(schedule, teamIds)
    for (const match of schedule) {
      const id = `${match.stationId}-r${match.round}-m${match.index}`
      transaction.create(db.doc(`matches/${id}`), {
        stationId: match.stationId,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        round: match.round,
        status: 'pending',
        winnerTeamId: null,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    addAudit(transaction, actor, 'generate', 'schedule', 'event', { matchCount: schedule.length, teamIds })
  })
  return { matchCount: 49 }
})

function validateGeneratedSchedule(
  schedule: Array<{ stationId: string; teamAId: string; teamBId: string }>,
  teamIds: string[],
): void {
  if (schedule.length !== 49) throw new HttpsError('internal', 'El calendario generado no contiene 49 enfrentamientos.')
  const opponents = new Set<string>()
  for (const stationId of COMPETITIVE_STATIONS) {
    const matches = schedule.filter((match) => match.stationId === stationId)
    const appearances = matches.flatMap((match) => [match.teamAId, match.teamBId])
    if (matches.length !== 7 || new Set(appearances).size !== 14 || teamIds.some((id) => !appearances.includes(id))) {
      throw new HttpsError('internal', `La programación de ${stationId} no es válida.`)
    }
    for (const match of matches) {
      const pair = [match.teamAId, match.teamBId].sort().join(':')
      if (match.teamAId === match.teamBId || opponents.has(pair)) {
        throw new HttpsError('internal', 'La programación contiene un enfrentamiento inválido o repetido.')
      }
      opponents.add(pair)
    }
  }
}

export const saveTeam = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const data = request.data
  const name = typeof data?.name === 'string' ? data.name.trim() : ''
  const color = typeof data?.color === 'string' ? data.color : ''
  const participants = Array.isArray(data?.participants) ? data.participants : []
  const complete = data?.complete === true
  const allowDuplicateParticipants = data?.allowDuplicateParticipants === true
  if (!name || name.length > 40 || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new HttpsError('invalid-argument', 'El nombre o el color del equipo no son válidos.')
  }
  if (participants.length > 6 || (complete && participants.length !== 6)) {
    throw new HttpsError('invalid-argument', 'Un equipo completo debe tener exactamente seis participantes y ningún equipo puede superar seis.')
  }
  const sanitizedParticipants = participants.map((participant: unknown) => {
    const item = participant as { id?: unknown; name?: unknown }
    if (typeof item?.name !== 'string' || !item.name.trim() || item.name.trim().length > 100) {
      throw new HttpsError('invalid-argument', 'Cada participante debe tener un nombre válido.')
    }
    return { id: typeof item.id === 'string' ? item.id : randomUUID(), name: item.name.trim() }
  })
  const participantNames = sanitizedParticipants.map((participant: { name: string }) => participant.name.toLocaleLowerCase())
  if (new Set(participantNames).size !== participantNames.length) {
    throw new HttpsError('already-exists', 'Hay participantes repetidos en este equipo.')
  }

  const requestedId = typeof data.id === 'string' ? data.id : randomUUID()
  const teamRef = db.doc(`teams/${requestedId}`)
  const publicTeamRef = db.doc(`publicTeams/${requestedId}`)
  await db.runTransaction(async (transaction) => {
    const [profileSnap, teamsSnap, oldTeamSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.collection('teams')),
      transaction.get(teamRef),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    const normalizedName = name.toLocaleLowerCase()
    const conflictingTeam = teamsSnap.docs.find((team) =>
      team.id !== requestedId && String(team.get('name') ?? '').trim().toLocaleLowerCase() === normalizedName)
    if (conflictingTeam) throw new HttpsError('already-exists', 'Ya existe un equipo con ese nombre.')
    const rosterNames = new Set<string>()
    for (const team of teamsSnap.docs) {
      if (team.id === requestedId) continue
      for (const participant of (team.get('participants') as Array<{ name?: string }> | undefined) ?? []) {
        if (typeof participant.name === 'string') rosterNames.add(participant.name.trim().toLocaleLowerCase())
      }
    }
    if (!allowDuplicateParticipants && participantNames.some((participantName: string) => rosterNames.has(participantName))) {
      throw new HttpsError('already-exists', 'Un participante ya está registrado en otro equipo.')
    }
    const team = {
      name,
      color,
      participants: sanitizedParticipants,
      complete,
      active: data.active !== false,
      updatedAt: FieldValue.serverTimestamp(),
      ...(oldTeamSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }
    transaction.set(teamRef, team)
    transaction.set(publicTeamRef, {
      name,
      color,
      complete,
      active: data.active !== false,
      updatedAt: FieldValue.serverTimestamp(),
    })
    addAudit(transaction, actor, oldTeamSnap.exists ? 'update' : 'create', 'team', requestedId, {
      previousName: oldTeamSnap.get('name') ?? null,
      name,
      participantCount: sanitizedParticipants.length,
      complete,
      allowDuplicateParticipants,
    })
  })
  return { teamId: requestedId }
})

export const saveStationGuide = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const data = request.data
  const stationId = typeof data?.id === 'string' ? data.id : ''
  const identity = STATION_IDENTITIES[stationId]
  if (!identity) throw new HttpsError('invalid-argument', 'La estación solicitada no existe.')
  const textFields = ['summary', 'context', 'objective'] as const
  const listFields = ['materials', 'preparation', 'instructions', 'rules', 'penalties', 'specialCases', 'safety', 'organizerNotes', 'criteria'] as const
  const text: Record<string, string> = {}
  for (const field of textFields) {
    const value = typeof data[field] === 'string' ? data[field].trim() : ''
    if (!value || value.length > 3000) throw new HttpsError('invalid-argument', `El campo ${field} es obligatorio y no puede superar 3000 caracteres.`)
    text[field] = value
  }
  const lists: Record<string, string[]> = {}
  for (const field of listFields) {
    const value = data[field]
    if (!Array.isArray(value) || value.length > 30 || value.some((entry: unknown) => typeof entry !== 'string' || entry.length > 500)) {
      throw new HttpsError('invalid-argument', `La lista ${field} no es válida.`)
    }
    lists[field] = value.map((entry: string) => entry.trim()).filter(Boolean)
  }
  const estimatedMinutes = data.estimatedMinutes
  if (estimatedMinutes !== null && (typeof estimatedMinutes !== 'number' || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 360)) {
    throw new HttpsError('invalid-argument', 'La duración debe ser de 1 a 360 minutos o quedar sin definir.')
  }
  const guide = {
    ...identity,
    ...text,
    ...lists,
    id: stationId,
    estimatedMinutes,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid,
  }
  if (stationId === 'caribe' && lists.criteria.length === 0) {
    throw new HttpsError('invalid-argument', 'Caribe debe tener al menos un criterio de evaluación.')
  }
  await db.runTransaction(async (transaction) => {
    const guideRef = db.doc(`stations/${stationId}`)
    const [profileSnap, existingGuide, evaluationsSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(guideRef),
      stationId === 'caribe'
        ? transaction.get(db.collection('caribeEvaluations').where('status', '==', 'confirmed'))
        : Promise.resolve(null),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    if (stationId === 'caribe' && evaluationsSnap && !evaluationsSnap.empty) {
      const oldCriteria = caribeCriteria(existingGuide.data())
      if (JSON.stringify(oldCriteria) !== JSON.stringify(lists.criteria)) {
        throw new HttpsError('failed-precondition', 'Los criterios Caribe no se pueden cambiar después de confirmar evaluaciones.')
      }
    }
    transaction.set(guideRef, guide)
    addAudit(transaction, actor, 'updateGuide', 'station', stationId, { game: identity.game })
  })
  return { saved: true }
})

export const saveScoringRules = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const data = request.data
  const values = ['win', 'draw', 'loss', 'caribeMinimum', 'caribeMaximum', 'caribeScaleMaximum'] as const
  const rules: Record<string, number> = {}
  for (const field of values) {
    const value = data?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000) {
      throw new HttpsError('invalid-argument', `La regla ${field} debe ser un número entre 0 y 10000.`)
    }
    rules[field] = value
  }
  if (rules.win < rules.draw || rules.draw < rules.loss || rules.caribeMaximum < rules.caribeMinimum || rules.caribeScaleMaximum <= 0) {
    throw new HttpsError('invalid-argument', 'Los valores de puntuación no forman una escala válida.')
  }
  const consolidation = data?.caribeConsolidation
  if (consolidation !== 'average' && consolidation !== 'weighted-average') {
    throw new HttpsError('invalid-argument', 'Selecciona un método de consolidación válido.')
  }
  const rawWeights = data?.caribeCriteriaWeights
  if (!rawWeights || typeof rawWeights !== 'object' || Array.isArray(rawWeights)) {
    throw new HttpsError('invalid-argument', 'Configura los pesos de los criterios de Caribe.')
  }
  const weights = rawWeights as Record<string, unknown>
  if (Object.keys(weights).length === 0 || Object.values(weights).some((weight) =>
    typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)
    || Object.values(weights).every((weight) => weight === 0)) {
    throw new HttpsError('invalid-argument', 'Los pesos deben ser números no negativos y al menos uno debe ser mayor a cero.')
  }
  await db.runTransaction(async (transaction) => {
    const [profileSnap, matchesSnap, evaluationsSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.collection('matches').where('status', '==', 'confirmed')),
      transaction.get(db.collection('caribeEvaluations').where('status', '==', 'confirmed')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    if (!matchesSnap.empty || !evaluationsSnap.empty) {
      throw new HttpsError('failed-precondition', 'Las reglas no se pueden cambiar después de confirmar resultados.')
    }
    const savedRules = { ...rules, caribeConsolidation: consolidation, caribeCriteriaWeights: weights }
    transaction.set(db.doc('scoringRules/default'), { rules: savedRules, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() })
    addAudit(transaction, actor, 'update', 'scoringRules', 'default', { rules: savedRules })
  })
  return { saved: true }
})

export const saveCaribeEvaluation = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const data = request.data
  const teamId = typeof data?.teamId === 'string' ? data.teamId : ''
  const criteriaScores = data?.criteriaScores
  const observations = typeof data?.observations === 'string' ? data.observations.slice(0, 1000) : ''
  if (!teamId || !criteriaScores || typeof criteriaScores !== 'object' || Array.isArray(criteriaScores)) {
    throw new HttpsError('invalid-argument', 'La evaluación de Caribe está incompleta.')
  }
  const scores = criteriaScores as Record<string, unknown>
  if (Object.values(scores).some((score) => typeof score !== 'number' || !Number.isFinite(score) || Number(score) < 0)) {
    throw new HttpsError('invalid-argument', 'Cada criterio debe tener una calificación numérica no negativa.')
  }
  const evaluatorIds = [uid]
  const evaluationRef = db.doc(`caribeEvaluations/${teamId}`)
  const publicRef = db.doc(`publicCaribeEvaluations/${teamId}`)
  await db.runTransaction(async (transaction) => {
    const [profileSnap, teamSnap, evaluationSnap, rulesSnap, stationSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.doc(`teams/${teamId}`)),
      transaction.get(evaluationRef),
      transaction.get(db.doc('scoringRules/default')),
      transaction.get(db.doc('stations/caribe')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireStationAccess(actor, 'caribe')
    if (!teamSnap.exists || teamSnap.get('active') !== true) throw new HttpsError('not-found', 'El equipo no está activo.')
    if (evaluationSnap.exists && evaluationSnap.get('status') === 'confirmed') {
      throw new HttpsError('already-exists', 'La evaluación de este equipo ya está confirmada.')
    }
    const rules = scoringRules(rulesSnap.data())
    const criteria = caribeCriteria(stationSnap.data())
    if (Object.keys(scores).length !== criteria.length || criteria.some((criterion) =>
      typeof scores[criterion] !== 'number' || Number(scores[criterion]) > rules.caribeScaleMaximum)) {
      throw new HttpsError('invalid-argument', `Cada criterio debe estar entre 0 y ${rules.caribeScaleMaximum}.`)
    }
    const mean = consolidateCaribeScore(scores, criteria, rules)
    const points = roundToTwoDecimals(rules.caribeMinimum + (rules.caribeMaximum - rules.caribeMinimum) * (mean / rules.caribeScaleMaximum))
    const confirmedAt = FieldValue.serverTimestamp()
    transaction.set(evaluationRef, {
      teamId,
      stationId: 'caribe',
      criteriaScores: scores,
      evaluators: evaluatorIds,
      consolidatedScore: mean,
      points,
      observations,
      status: 'confirmed',
      confirmedBy: actor.uid,
      confirmedAt,
    })
    transaction.set(publicRef, {
      teamId,
      consolidatedScore: mean,
      points,
      status: 'confirmed',
      confirmedAt,
    })
    addAudit(transaction, actor, evaluationSnap.exists ? 'update' : 'confirm', 'caribeEvaluation', teamId, {
      consolidatedScore: roundToTwoDecimals(mean),
      points,
    })
  })
  return { confirmed: true }
})

export const saveCaribeDraft = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const data = request.data
  const teamId = typeof data?.teamId === 'string' ? data.teamId : ''
  const criteriaScores = data?.criteriaScores
  const scores = criteriaScores && typeof criteriaScores === 'object' && !Array.isArray(criteriaScores)
    ? criteriaScores as Record<string, unknown>
    : {}
  const sanitizedScores: Record<string, number> = {}
  for (const [criterion, score] of Object.entries(scores)) {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      throw new HttpsError('invalid-argument', 'Los criterios deben tener una calificación numérica no negativa.')
    }
    sanitizedScores[criterion] = score
  }
  const observations = typeof data?.observations === 'string' ? data.observations.slice(0, 1000) : ''
  if (!teamId) throw new HttpsError('invalid-argument', 'Debes seleccionar un equipo.')
  const evaluationRef = db.doc(`caribeEvaluations/${teamId}`)
  await db.runTransaction(async (transaction) => {
    const [profileSnap, teamSnap, evaluationSnap, rulesSnap, stationSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.doc(`teams/${teamId}`)),
      transaction.get(evaluationRef),
      transaction.get(db.doc('scoringRules/default')),
      transaction.get(db.doc('stations/caribe')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireStationAccess(actor, 'caribe')
    if (!teamSnap.exists || teamSnap.get('active') !== true) throw new HttpsError('not-found', 'El equipo no está activo.')
    if (evaluationSnap.exists && evaluationSnap.get('status') === 'confirmed') {
      throw new HttpsError('already-exists', 'La evaluación de este equipo ya está confirmada.')
    }
    const rules = scoringRules(rulesSnap.data())
    const criteria = caribeCriteria(stationSnap.data())
    if (Object.keys(sanitizedScores).some((criterion) => !criteria.includes(criterion))
      || Object.values(sanitizedScores).some((score) => score > rules.caribeScaleMaximum)) {
      throw new HttpsError('invalid-argument', `Cada criterio debe estar entre 0 y ${rules.caribeScaleMaximum}.`)
    }
    transaction.set(evaluationRef, {
      teamId,
      stationId: 'caribe',
      criteriaScores: sanitizedScores,
      evaluators: [uid],
      observations,
      status: 'pending',
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    addAudit(transaction, actor, 'saveDraft', 'caribeEvaluation', teamId, {
      completedCriteria: Object.keys(sanitizedScores).length,
    })
  })
  return { saved: true }
})

export const correctCaribeEvaluation = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const teamId = typeof request.data?.teamId === 'string' ? request.data.teamId : ''
  const criteriaScores = request.data?.criteriaScores
  const observations = typeof request.data?.observations === 'string' ? request.data.observations.slice(0, 1000) : ''
  if (!teamId || !criteriaScores || typeof criteriaScores !== 'object' || Array.isArray(criteriaScores)) {
    throw new HttpsError('invalid-argument', 'La evaluación de Caribe está incompleta.')
  }
  const scores = criteriaScores as Record<string, unknown>
  await db.runTransaction(async (transaction) => {
    const evaluationRef = db.doc(`caribeEvaluations/${teamId}`)
    const publicRef = db.doc(`publicCaribeEvaluations/${teamId}`)
    const [profileSnap, evaluationSnap, publicSnap, rulesSnap] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(evaluationRef),
      transaction.get(publicRef),
      transaction.get(db.doc('scoringRules/default')),
    ])
    const actor = actorFromSnapshot(uid, profileSnap.data())
    requireAdmin(actor)
    if (!evaluationSnap.exists || evaluationSnap.get('status') !== 'confirmed' || !publicSnap.exists) {
      throw new HttpsError('failed-precondition', 'Solo se pueden corregir evaluaciones confirmadas.')
    }
    const criteria = Object.keys(evaluationSnap.get('criteriaScores') ?? {})
    if (criteria.length === 0 || Object.keys(scores).length !== criteria.length || criteria.some((criterion) =>
      typeof scores[criterion] !== 'number' || !Number.isFinite(scores[criterion]) || Number(scores[criterion]) < 0)) {
      throw new HttpsError('invalid-argument', 'Las calificaciones no coinciden con los criterios de Caribe.')
    }
    const rules = scoringRules(rulesSnap.data())
    if (criteria.some((criterion) => Number(scores[criterion]) > rules.caribeScaleMaximum)) {
      throw new HttpsError('invalid-argument', `Cada criterio debe estar entre 0 y ${rules.caribeScaleMaximum}.`)
    }
    const previous = {
      criteriaScores: evaluationSnap.get('criteriaScores'),
      consolidatedScore: evaluationSnap.get('consolidatedScore'),
      points: evaluationSnap.get('points'),
    }
    const consolidatedScore = consolidateCaribeScore(scores, criteria, rules)
    const points = roundToTwoDecimals(rules.caribeMinimum + (rules.caribeMaximum - rules.caribeMinimum) * (consolidatedScore / rules.caribeScaleMaximum))
    const correction = {
      criteriaScores: scores,
      consolidatedScore,
      points,
      observations,
      correctedBy: uid,
      correctedAt: FieldValue.serverTimestamp(),
    }
    transaction.update(evaluationRef, correction)
    transaction.update(publicRef, { consolidatedScore, points, correctedAt: FieldValue.serverTimestamp() })
    addAudit(transaction, actor, 'correct', 'caribeEvaluation', teamId, { previous, next: correction })
  })
  return { corrected: true }
})

export const setUserAccess = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid
  assertSignedIn(uid)
  const targetUid = request.data?.uid
  const role = request.data?.role
  const stationIds = request.data?.stationIds
  const allowedStations = ['caribe', ...COMPETITIVE_STATIONS]
  if (typeof targetUid !== 'string' || !['admin', 'collaborator', 'participant'].includes(role) || !Array.isArray(stationIds) || stationIds.some((id: unknown) => typeof id !== 'string' || !allowedStations.includes(id))) {
    throw new HttpsError('invalid-argument', 'Los datos del usuario o su rol no son válidos.')
  }
  if (targetUid === uid) throw new HttpsError('failed-precondition', 'No puedes modificar tu propio rol.')
  const caller = actorFromSnapshot(uid, (await db.doc(`users/${uid}`).get()).data())
  requireAdmin(caller)
  const authUser = await (await import('firebase-admin/auth')).getAuth().getUser(targetUid)
  await db.runTransaction(async (transaction) => {
    const actor = await actorInTransaction(transaction, uid)
    requireAdmin(actor)
    const targetRef = db.doc(`users/${targetUid}`)
    const target = await transaction.get(targetRef)
    const updated = {
      ...target.data(),
      uid: targetUid,
      email: authUser.email ?? target.get('email') ?? '',
      name: target.get('name') ?? authUser.displayName ?? authUser.email ?? 'Usuario',
      role,
      stationIds,
      active: request.data.active !== false,
      updatedAt: FieldValue.serverTimestamp(),
      ...(target.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }
    transaction.set(targetRef, updated)
    addAudit(transaction, actor, 'updateAccess', 'user', targetUid, { role, stationIds })
  })
  return { updated: true }
})

function actorFromSnapshot(uid: string, data: DocumentData | undefined): Actor {
  const role = data?.role
  return {
    uid,
    role: role === 'admin' || role === 'collaborator' || role === 'participant' ? role : null,
    stationIds: Array.isArray(data?.stationIds) ? data.stationIds.filter((id): id is string => typeof id === 'string') : [],
    active: data?.active === true,
  }
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
