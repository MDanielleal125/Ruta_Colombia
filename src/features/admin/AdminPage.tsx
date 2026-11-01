import { useState } from 'react'
import { Download, FileCheck2, LockKeyhole, RefreshCw, Save, ShieldCheck, UsersRound } from 'lucide-react'
import type { AuditEntry, CaribeEvaluation, EventUser, Match, ScoringRules, StationGuide, Team } from '../../domain/types'
import type { SessionUser } from '../../services/firebase/auth'

interface AdminPageProps {
  session: SessionUser | null
  teams: Team[]
  matches: Match[]
  evaluations: CaribeEvaluation[]
  stations: StationGuide[]
  scoringRules: ScoringRules
  users: EventUser[]
  auditLogs: AuditEntry[]
  configured: boolean
  onGenerateSchedule: () => Promise<void>
  onExport: () => Promise<void>
  onSaveStation: (guide: StationGuide) => Promise<void>
  onSaveScoringRules: (rules: ScoringRules) => Promise<void>
  onSetUserAccess: (input: { uid: string; role: Exclude<EventUser['role'], null>; stationIds: string[]; active: boolean }) => Promise<void>
}

export function AdminPage({
  session, teams, matches, evaluations, stations, scoringRules, users, auditLogs, configured,
  onGenerateSchedule, onExport, onSaveStation, onSaveScoringRules, onSetUserAccess,
}: AdminPageProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState(stations[0].id)
  const [guideDrafts, setGuideDrafts] = useState<Record<string, StationGuide>>({})
  const [rulesDraft, setRulesDraft] = useState<ScoringRules | null>(null)
  const [userUid, setUserUid] = useState('')
  const [userRole, setUserRole] = useState<Exclude<EventUser['role'], null>>('collaborator')
  const [userStations, setUserStations] = useState<string[]>([])
  const [userActive, setUserActive] = useState(true)
  const isAdmin = session?.role === 'admin'
  const activeTeams = teams.filter((team) => team.active)
  const confirmed = matches.filter((match) => match.status === 'confirmed').length + evaluations.filter((item) => item.status === 'confirmed').length
  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? stations[0]
  const selectedGuide = guideDrafts[selectedStation.id] ?? selectedStation
  const activeRules = rulesDraft ?? scoringRules
  const caribeCriteria = stations.find((station) => station.id === 'caribe')?.criteria ?? []

  async function generate() {
    if (activeTeams.length !== 14 || activeTeams.some((team) => !team.complete)) {
      setError('Se requieren exactamente 14 equipos activos y completos antes de generar la programación.')
      return
    }
    if (matches.some((match) => match.status === 'confirmed')) {
      setError('Ya existen resultados confirmados. No se puede reemplazar la programación.')
      return
    }
    if (!window.confirm('Se generarán 49 enfrentamientos únicos para las siete estaciones competitivas. Caribe seguirá sin parejas. ¿Continuar?')) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await onGenerateSchedule()
      setMessage('Programación creada y confirmada por el servidor.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar la programación.')
    } finally {
      setBusy(false)
    }
  }

  async function exportData() {
    setBusy(true)
    setError(null)
    try {
      await onExport()
      setMessage('Clasificación exportada a Excel.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo exportar la clasificación.')
    } finally {
      setBusy(false)
    }
  }

  function updateGuide(field: keyof StationGuide, value: string) {
    const updated = { ...selectedGuide, [field]: value }
    setGuideDrafts((current) => ({ ...current, [selectedStation.id]: updated }))
  }

  function updateGuideList(field: keyof Pick<StationGuide, 'materials' | 'preparation' | 'instructions' | 'rules' | 'penalties' | 'specialCases' | 'safety' | 'organizerNotes' | 'criteria'>, value: string) {
    const updated = {
      ...selectedGuide,
      [field]: value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    }
    setGuideDrafts((current) => ({ ...current, [selectedStation.id]: updated }))
  }

  async function saveGuide() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await onSaveStation(selectedGuide)
      setGuideDrafts((current) => {
        const next = { ...current }
        delete next[selectedStation.id]
        return next
      })
      setMessage(`Ficha de ${selectedStation.region} guardada en Firestore.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la ficha.')
    } finally {
      setBusy(false)
    }
  }

  async function saveRules() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await onSaveScoringRules(activeRules)
      setRulesDraft(null)
      setMessage('Reglas de puntuación confirmadas por el servidor.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar las reglas.')
    } finally {
      setBusy(false)
    }
  }

  async function saveAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await onSetUserAccess({ uid: userUid.trim(), role: userRole, stationIds: userStations, active: userActive })
      setMessage('Permisos del usuario actualizados.')
      setUserUid('')
      setUserStations([])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron actualizar los permisos.')
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) {
    return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow muted-eyebrow">GESTIÓN DEL EVENTO</span><h1>Administración</h1></div></div><div className="surface-card empty-state"><div className="empty-state-icon"><LockKeyhole size={23} /></div><h2>Acceso restringido</h2><p>Este módulo requiere el rol de administrador asignado por la organización.</p></div></div>
  }

  return (
    <div className="page-stack">
      <div className="page-title-row"><div><span className="eyebrow muted-eyebrow">CONTROL CENTRAL</span><h1>Administración</h1><p>Prepara la programación y consulta el estado de los registros.</p></div><span className="admin-role-badge"><ShieldCheck size={16} /> ADMINISTRADOR</span></div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      {!configured && <div className="notice notice-warning">Conecta Firebase para habilitar las operaciones administrativas.</div>}
      <div className="admin-stat-grid">
        <div className="surface-card admin-stat"><UsersRound size={19} /><span>Equipos listos</span><strong>{activeTeams.filter((team) => team.complete).length} / 14</strong></div>
        <div className="surface-card admin-stat"><FileCheck2 size={19} /><span>Enfrentamientos</span><strong>{matches.length} / 49</strong></div>
        <div className="surface-card admin-stat"><ShieldCheck size={19} /><span>Registros confirmados</span><strong>{confirmed} / 63</strong></div>
      </div>
      <div className="admin-tools-grid">
        <article className="surface-card admin-tool-card">
          <div className="tool-icon"><RefreshCw size={21} /></div><span className="eyebrow muted-eyebrow">PROGRAMACIÓN</span>
          <h2>Generar enfrentamientos</h2>
          <p>Genera siete rondas de rotación para las estaciones competitivas. Cada equipo juega una vez por estación y no repite rival. Caribe se mantiene como actividad colectiva.</p>
          <button className="button button-primary" disabled={!configured || busy || matches.length > 0} onClick={() => void generate()}>{busy ? 'Procesando…' : 'Validar y generar 49 enfrentamientos'}</button>
          {matches.length > 0 && <small>La programación ya existe. Para proteger resultados, no se puede volver a generar desde esta pantalla.</small>}
        </article>
        <article className="surface-card admin-tool-card">
          <div className="tool-icon yellow-tool"><Download size={21} /></div><span className="eyebrow muted-eyebrow">REPORTES</span>
          <h2>Exportar clasificación</h2>
          <p>Descarga posiciones, puntos por estación, victorias, empates, derrotas y progreso de los equipos en formato Excel.</p>
          <button className="button button-outline" disabled={!configured || teams.length === 0 || busy} onClick={() => void exportData()}><Download size={16} /> Descargar .xlsx</button>
        </article>
      </div>
      <section className="surface-card admin-editor">
        <div className="admin-editor-heading"><div><span className="eyebrow muted-eyebrow">CONTENIDO EDITABLE</span><h2>Fichas de estación</h2></div><label className="station-select-label">ESTACIÓN<select value={selectedStation.id} onChange={(event) => setSelectedStationId(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.region} · {station.game}</option>)}</select></label></div>
        <p className="admin-helper">Las ocho regiones y el tipo de actividad son fijos. Edita las instrucciones sin cambiar la modalidad colectiva de Caribe.</p>
        <div className="guide-editor-grid">
          <label className="field-label">Resumen<input value={selectedGuide.summary} maxLength={500} onChange={(event) => updateGuide('summary', event.target.value)} /></label>
          <label className="field-label">Contexto cultural<textarea rows={3} value={selectedGuide.context} onChange={(event) => updateGuide('context', event.target.value)} /></label>
          <label className="field-label">Objetivo<textarea rows={3} value={selectedGuide.objective} onChange={(event) => updateGuide('objective', event.target.value)} /></label>
          <label className="field-label">Materiales · uno por línea<textarea rows={4} value={selectedGuide.materials.join('\n')} onChange={(event) => updateGuideList('materials', event.target.value)} /></label>
          <label className="field-label">Preparación · uno por línea<textarea rows={4} value={selectedGuide.preparation.join('\n')} onChange={(event) => updateGuideList('preparation', event.target.value)} /></label>
          <label className="field-label">Pasos · uno por línea<textarea rows={5} value={selectedGuide.instructions.join('\n')} onChange={(event) => updateGuideList('instructions', event.target.value)} /></label>
          <label className="field-label">Reglas · uno por línea<textarea rows={4} value={selectedGuide.rules.join('\n')} onChange={(event) => updateGuideList('rules', event.target.value)} /></label>
          <label className="field-label">Penalizaciones · uno por línea<textarea rows={3} value={selectedGuide.penalties.join('\n')} onChange={(event) => updateGuideList('penalties', event.target.value)} /></label>
          <label className="field-label">Situaciones especiales · uno por línea<textarea rows={3} value={selectedGuide.specialCases.join('\n')} onChange={(event) => updateGuideList('specialCases', event.target.value)} /></label>
          <label className="field-label">Seguridad · uno por línea<textarea rows={3} value={selectedGuide.safety.join('\n')} onChange={(event) => updateGuideList('safety', event.target.value)} /></label>
          <label className="field-label">Notas del organizador · uno por línea<textarea rows={3} value={selectedGuide.organizerNotes.join('\n')} onChange={(event) => updateGuideList('organizerNotes', event.target.value)} /></label>
          {selectedStation.criteria && <label className="field-label">Criterios · uno por línea<textarea rows={3} value={(selectedGuide.criteria ?? []).join('\n')} onChange={(event) => updateGuideList('criteria', event.target.value)} /></label>}
          <label className="field-label">Duración estimada en minutos<input type="number" min="1" max="360" value={selectedGuide.estimatedMinutes ?? ''} onChange={(event) => setGuideDrafts((current) => ({ ...current, [selectedStation.id]: { ...selectedGuide, estimatedMinutes: event.target.value ? Number(event.target.value) : null } }))} placeholder="Por definir" /></label>
        </div>
        <div className="admin-editor-footer"><span>Se publican cambios solo después de confirmarlos.</span><button className="button button-primary" disabled={!configured || busy} onClick={() => void saveGuide()}><Save size={15} /> Guardar ficha</button></div>
      </section>

      <section className="surface-card admin-editor">
        <div><span className="eyebrow muted-eyebrow">REGLAS DEL EVENTO</span><h2 className="admin-editor-title">Configuración de puntuación</h2></div>
        <p className="admin-helper">Las reglas quedan bloqueadas una vez que haya resultados confirmados, para mantener los puntos consistentes.</p>
        <div className="scoring-settings-grid">
          {([
            ['Victoria', 'win'], ['Empate', 'draw'], ['Derrota', 'loss'],
            ['Mínimo Caribe', 'caribeMinimum'], ['Máximo Caribe', 'caribeMaximum'], ['Escala Caribe', 'caribeScaleMaximum'],
          ] as const).map(([label, key]) => <label className="field-label" key={key}>{label}<input type="number" min="0" max="10000" step="0.01" value={activeRules[key]} onChange={(event) => setRulesDraft({ ...activeRules, [key]: Number(event.target.value) })} /></label>)}
        </div>
        <div className="scoring-settings-grid">
          <label className="field-label">Consolidación Caribe<select value={activeRules.caribeConsolidation} onChange={(event) => setRulesDraft({ ...activeRules, caribeConsolidation: event.target.value as ScoringRules['caribeConsolidation'] })}><option value="average">Promedio simple</option><option value="weighted-average">Promedio ponderado</option></select></label>
          {caribeCriteria.map((criterion) => <label className="field-label" key={criterion}>Peso · {criterion}<input type="number" min="0" max="10000" step="0.1" value={activeRules.caribeCriteriaWeights[criterion] ?? 1} onChange={(event) => setRulesDraft({ ...activeRules, caribeCriteriaWeights: { ...activeRules.caribeCriteriaWeights, [criterion]: Number(event.target.value) } })} /></label>)}
        </div>
        <div className="admin-editor-footer"><span>Orden requerido: victoria ≥ empate ≥ derrota. El peso debe ser positivo para al menos un criterio.</span><button className="button button-primary" disabled={!configured || busy || confirmed > 0} onClick={() => void saveRules()}><Save size={15} /> Guardar puntuación</button></div>
      </section>

      <section className="admin-user-grid">
        <div className="surface-card admin-editor">
          <div><span className="eyebrow muted-eyebrow">AUTORIZACIÓN</span><h2 className="admin-editor-title">Usuarios y estaciones</h2></div>
          <p className="admin-helper">Crea la cuenta en Firebase Authentication y asigna su perfil aquí con el UID. No se puede modificar el rol de la sesión actual.</p>
          <form onSubmit={(event) => void saveAccess(event)}>
            <label className="field-label">UID de Firebase Authentication<input required value={userUid} onChange={(event) => setUserUid(event.target.value)} placeholder="UID existente" /></label>
            <label className="field-label user-role-select">Rol<select value={userRole} onChange={(event) => setUserRole(event.target.value as Exclude<EventUser['role'], null>)}><option value="collaborator">Colaborador</option><option value="participant">Participante</option><option value="admin">Administrador</option></select></label>
            {userRole === 'collaborator' && <fieldset className="station-access-field"><legend>Estaciones asignadas</legend>{stations.map((station) => <label key={station.id}><input type="checkbox" checked={userStations.includes(station.id)} onChange={(event) => setUserStations((current) => event.target.checked ? [...current, station.id] : current.filter((id) => id !== station.id))} />{station.region}</label>)}</fieldset>}
            <label className="checkbox-field"><input type="checkbox" checked={userActive} onChange={(event) => setUserActive(event.target.checked)} /> Usuario activo</label>
            <button type="submit" className="button button-primary full-button" disabled={!configured || busy || !userUid.trim()}><ShieldCheck size={15} /> Asignar permisos</button>
          </form>
        </div>
        <div className="surface-card user-list-card">
          <div className="subsection-title"><UsersRound size={17} /><strong>Usuarios registrados</strong><span>{users.length}</span></div>
          {users.map((user) => <button className="user-row" key={user.uid} onClick={() => { setUserUid(user.uid); setUserRole(user.role ?? 'participant'); setUserStations(user.stationIds); setUserActive(user.active) }}><span className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-row-info"><strong>{user.name}</strong><small>{user.email}</small></span><span className={`user-role-tag ${user.active ? '' : 'disabled'}`}>{user.active ? user.role ?? 'sin rol' : 'inactivo'}</span></button>)}
          {users.length === 0 && <p className="empty-inline">Los perfiles aparecerán después de asignar usuarios.</p>}
        </div>
      </section>
      <section className="surface-card audit-card">
        <div className="subsection-title"><ShieldCheck size={17} /><strong>Auditoría reciente</strong><span>Últimos {auditLogs.length} registros</span></div>
        {auditLogs.map((entry) => <div className="audit-row" key={entry.id}>
          <span className="audit-event-icon"><FileCheck2 size={14} /></span>
          <span className="audit-row-main"><strong>{auditLabel(entry.action)} · {entityLabel(entry.entity)}</strong><small>{entry.entityId} · UID {entry.actorUid}</small></span>
          <time>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'Pendiente'}</time>
        </div>)}
        {auditLogs.length === 0 && <p className="empty-inline">Las acciones administrativas aparecerán aquí.</p>}
      </section>
      <section className="surface-card admin-note"><ShieldCheck size={18} /><div><strong>Protección de cambios</strong><p>Las confirmaciones se procesan en Cloud Functions; las reglas de Firestore limitan el acceso por rol y estación. La primera cuenta administradora debe ser provisionada de forma segura siguiendo la documentación del proyecto.</p></div></section>
    </div>
  )
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    confirm: 'Confirmó resultado',
    correct: 'Corrigió resultado',
    generate: 'Generó programación',
    create: 'Creó registro',
    update: 'Actualizó configuración',
    updateGuide: 'Editó ficha',
    updateAccess: 'Cambió permisos',
    saveDraft: 'Guardó borrador',
  }
  return labels[action] ?? action
}

function entityLabel(entity: string) {
  const labels: Record<string, string> = {
    match: 'enfrentamiento',
    schedule: 'programación',
    team: 'equipo',
    station: 'estación',
    user: 'usuario',
    scoringRules: 'puntuación',
    caribeEvaluation: 'evaluación Caribe',
  }
  return labels[entity] ?? entity
}
