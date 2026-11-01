import { useState } from 'react'
import { Check, PencilLine, Plus, Save, UsersRound, X } from 'lucide-react'
import type { Participant, Team } from '../../domain/types'

interface TeamsPageProps {
  teams: Team[]
  canManage: boolean
  revealParticipants: boolean
  onSave: (team: Omit<Team, 'id'> & { id?: string }, allowDuplicateParticipants: boolean) => Promise<void>
}

const emptyParticipants = (): Participant[] =>
  Array.from({ length: 6 }, () => ({ id: crypto.randomUUID(), name: '' }))

export function TeamsPage({ teams, canManage, revealParticipants, onSave }: TeamsPageProps) {
  const [editing, setEditing] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#157f78')
  const [participants, setParticipants] = useState<Participant[]>(emptyParticipants)
  const [complete, setComplete] = useState(false)
  const [allowDuplicateParticipants, setAllowDuplicateParticipants] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function startCreate() {
    setEditing(null)
    setName('')
    setColor('#157f78')
    setParticipants(emptyParticipants())
    setComplete(false)
    setAllowDuplicateParticipants(false)
    setError(null)
    setSuccess(null)
  }

  function startEdit(team: Team) {
    setEditing(team)
    setName(team.name)
    setColor(team.color)
    setParticipants(Array.from({ length: 6 }, (_, index) => team.participants[index] ?? { id: crypto.randomUUID(), name: '' }))
    setComplete(team.complete)
    setError(null)
    setSuccess(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      await onSave({
        ...(editing ? { id: editing.id } : {}),
        name,
        color,
        participants: participants.filter((participant) => participant.name.trim()),
        complete,
        active: true,
      }, allowDuplicateParticipants)
      setSuccess('Equipo guardado y confirmado por el servidor.')
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el equipo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow muted-eyebrow">14 EQUIPOS · 84 PARTICIPANTES</span><h1>Los equipos</h1><p>Una ruta compartida, seis integrantes por equipo.</p></div>
        {canManage && <button className="button button-primary" onClick={startCreate}><Plus size={17} /> Nuevo equipo</button>}
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice notice-success" role="status">{success}</div>}

      {canManage && (
        <form className="surface-card team-form" onSubmit={submit}>
          <div className="form-heading"><div><span className="eyebrow muted-eyebrow">{editing ? 'EDITAR REGISTRO' : 'REGISTRO DE EQUIPO'}</span><h2>{editing ? editing.name : 'Nuevo equipo'}</h2></div><button type="button" className="icon-button" aria-label="Limpiar formulario" onClick={startCreate}><X size={18} /></button></div>
          <div className="form-grid">
            <label className="field-label">Nombre del equipo<input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Nombre del equipo" /></label>
            <label className="field-label">Color distintivo<span className="color-input"><input aria-label="Color del equipo" type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>{color.toUpperCase()}</span></span></label>
          </div>
          <div className="participant-fields">
            <div className="subsection-title"><UsersRound size={17} /><strong>Integrantes</strong><span>Hasta 6 por equipo</span></div>
            <div className="participant-grid">
              {participants.map((participant, index) => (
                <label className="field-label" key={participant.id}>
                  <span>Participante {index + 1}</span>
                  <input value={participant.name} onChange={(event) => setParticipants((current) => current.map((item) => item.id === participant.id ? { ...item, name: event.target.value } : item))} placeholder="Nombre completo" />
                </label>
              ))}
            </div>
          </div>
          <label className="checkbox-field"><input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} /> Marcar como equipo completo <span>(requiere seis participantes)</span></label>
          <label className="checkbox-field"><input type="checkbox" checked={allowDuplicateParticipants} onChange={(event) => setAllowDuplicateParticipants(event.target.checked)} /> Autorizar excepción de participante duplicado <span>(queda registrada en auditoría)</span></label>
          <div className="form-footer"><span>Los cambios se guardan en Firestore mediante una operación autorizada.</span><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : <><Save size={16} /> Guardar equipo</>}</button></div>
        </form>
      )}

      {teams.length === 0 ? (
        <div className="surface-card empty-state"><div className="empty-state-icon"><UsersRound size={24} /></div><h2>Aún no hay equipos</h2><p>{canManage ? 'Crea el primer equipo para comenzar a preparar la programación.' : 'Los equipos aparecerán aquí cuando sean registrados por la organización.'}</p></div>
      ) : (
        <div className="team-grid">
          {teams.map((team, index) => (
            <article className="surface-card team-card" key={team.id}>
              <div className="team-card-head"><span className="team-index">EQUIPO {String(index + 1).padStart(2, '0')}</span>{team.complete ? <span className="complete-tag"><Check size={13} /> Completo</span> : <span className="incomplete-tag">{team.participants.length}/6 integrantes</span>}</div>
              <div className="team-identity"><span className="team-color-mark" style={{ backgroundColor: team.color }} /><h2>{team.name}</h2></div>
              {revealParticipants ? <ul className="participant-list">{team.participants.map((person) => <li key={person.id}>{person.name}</li>)}</ul> : <p className="privacy-note">Integrantes visibles solo para usuarios autorizados.</p>}
              {canManage && <button className="text-button" onClick={() => startEdit(team)}><PencilLine size={15} /> Editar equipo</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
