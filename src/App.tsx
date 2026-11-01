import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BarChart3, BookOpen, Check, ChevronDown, CircleUserRound,
  ClipboardList, Home, LogIn, LogOut, Menu, Settings2, ShieldCheck, Users,
  Wifi, X,
} from 'lucide-react'
import { Dashboard } from './features/dashboard/Dashboard'
import { StationsPage } from './features/stations/StationsPage'
import { StandingsPage } from './features/standings/StandingsPage'
import { TeamsPage } from './features/teams/TeamsPage'
import { ResultsPage } from './features/results/ResultsPage'
import { AdminPage } from './features/admin/AdminPage'
import { useEventData } from './app/useEventData'
import {
  confirmMatchResult,
  correctMatchResult,
  correctCaribeEvaluation,
  createSchedule,
  saveCaribeEvaluation,
  saveCaribeDraft,
  saveScoringRules,
  saveStationGuide,
  saveTeam,
  setUserAccess,
  signIn,
  signOutUser,
} from './services/eventActions'
import { exportEventReport, exportStandings } from './services/exportWorkbook'
import { calculateStandings } from './domain/scoring'
import type { Team } from './domain/types'
import './App.css'

const navigation = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'stations', label: 'Estaciones', icon: Activity },
  { id: 'results', label: 'Resultados', icon: ClipboardList },
  { id: 'standings', label: 'Clasificación', icon: BarChart3 },
  { id: 'teams', label: 'Equipos', icon: Users },
  { id: 'admin', label: 'Administración', icon: Settings2 },
]

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function App() {
  const data = useEventData()
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>()
  const [loginOpen, setLoginOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const standings = useMemo(
    () => calculateStandings(data.teams.filter((team) => team.active), data.matches, data.evaluations, data.scoringRules),
    [data.teams, data.matches, data.evaluations, data.scoringRules],
  )

  useEffect(() => {
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  useEffect(() => {
    const installHandler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', installHandler)
    return () => window.removeEventListener('beforeinstallprompt', installHandler)
  }, [])

  function navigate(view: string) {
    setActiveView(view)
    setMobileMenuOpen(false)
    setAccountMenuOpen(false)
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError(null)
    const form = new FormData(event.currentTarget)
    try {
      await signIn(String(form.get('email')), String(form.get('password')))
      setLoginOpen(false)
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.')
    }
  }

  async function handleLogout() {
    try {
      await signOutUser()
      setAccountMenuOpen(false)
    } catch (reason) {
      setGlobalError(reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.')
    }
  }

  async function handleInstall() {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } catch (reason) {
      setGlobalError(reason instanceof Error ? reason.message : 'No se pudo iniciar la instalación.')
    }
  }

  async function handleSaveTeam(team: Omit<Team, 'id'> & { id?: string }, allowDuplicateParticipants: boolean) {
    setGlobalError(null)
    await saveTeam(team, allowDuplicateParticipants)
  }

  async function handleGenerateSchedule() {
    setGlobalError(null)
    await createSchedule()
  }

  async function handleExport() {
    await exportStandings(standings)
  }

  async function handleAdminExport() {
    await exportEventReport({
      standings,
      teams: data.teams,
      matches: data.matches,
      evaluations: data.evaluations,
      stations: data.stations,
    })
  }

  function openStationResults(stationId: string) {
    setSelectedStationId(stationId)
    navigate('results')
  }

  const currentNav = navigation.find((item) => item.id === activeView)
  const canSeeAdmin = data.session?.role === 'admin'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div className="brand-name">ruta<span>colombia</span><small>EVENTO DEPORTIVO</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="event-switcher"><div className="event-avatar">RC</div><div><strong>Ruta Colombia</strong><span>Evento activo</span></div><ChevronDown size={15} /></div>
        <nav className="side-nav" aria-label="Navegación principal">
          <span className="nav-section-label">ESPACIO DE EVENTO</span>
          {navigation.filter((item) => item.id !== 'admin' || canSeeAdmin).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? 'nav-item-active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={activeView === id ? 2.2 : 1.8} /><span>{label}</span>{id === 'standings' && <span className="nav-live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="route-mini-card"><div className="route-mini-icon"><BookOpen size={17} /></div><div><strong>El recorrido</strong><span>8 estaciones · 63 registros</span></div><ArrowRight size={16} /></div>
          <button className="profile-button" onClick={() => data.session ? setAccountMenuOpen((open) => !open) : setLoginOpen(true)}>
            <span className="profile-avatar">{data.session ? data.session.name.slice(0, 1).toUpperCase() : <CircleUserRound size={19} />}</span>
            <span className="profile-details"><strong>{data.session?.name ?? 'Invitado'}</strong><small>{data.session ? roleLabel(data.session.role) : 'Vista pública'}</small></span>
            {data.session ? <ChevronDown size={15} /> : <LogIn size={16} />}
          </button>
          {accountMenuOpen && <div className="account-popover"><button onClick={() => void handleLogout()}><LogOut size={15} /> Cerrar sesión</button></div>}
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          <div className="breadcrumb"><span>Ruta Colombia</span><span className="breadcrumb-slash">/</span><strong>{currentNav?.label ?? 'Inicio'}</strong></div>
          <div className="topbar-actions">
            <span className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}><span className="connection-dot" />{online ? 'En línea' : 'Sin conexión'}</span>
            {installPrompt && <button className="topbar-login install-button" onClick={() => void handleInstall()}>Instalar app</button>}
            {data.configured && data.session
              ? <span className="sync-status">{data.hasPendingWrites ? <><Wifi size={15} /> Sincronizando</> : !online ? <><Wifi size={15} /> {data.hasServerSnapshot ? 'Datos en caché' : 'Sin conexión'}</> : !data.hasServerSnapshot ? <><Wifi size={15} /> Conectando</> : data.fromCache ? <><Wifi size={15} /> Datos en caché</> : <><Check size={15} /> Conectado</>}</span>
              : <button className="topbar-login" onClick={() => setLoginOpen(true)}><LogIn size={16} /> Iniciar sesión</button>}
          </div>
        </header>

        <div className="content-area">
          {!data.configured && <div className="setup-banner"><ShieldCheck size={18} /><span><strong>Vista de configuración.</strong> Conecta Firebase para cargar y sincronizar datos reales. No se muestran resultados de demostración.</span><button onClick={() => navigate('admin')}>Ver configuración</button></div>}
          {data.error && <div className="notice notice-error" role="alert">{data.error}</div>}
          {globalError && <div className="notice notice-error" role="alert">{globalError}</div>}
          {data.authLoading ? <div className="loading-view"><div className="loader-mark" /><span>Preparando tu espacio de evento…</span></div> : (
            <>
              {activeView === 'dashboard' && <Dashboard teams={data.teams} matches={data.matches} evaluations={data.evaluations} stations={data.stations} onNavigate={navigate} />}
              {activeView === 'stations' && <StationsPage matches={data.matches} evaluations={data.evaluations} stations={data.stations} onOpenResults={openStationResults} />}
              {activeView === 'results' && <ResultsPage teams={data.teams} matches={data.matches} evaluations={data.evaluations} stations={data.stations} scoringRules={data.scoringRules} session={data.session} configured={data.configured} initialStationId={selectedStationId} onConfirmMatch={confirmMatchResult} onCorrectMatch={correctMatchResult} onConfirmCaribe={saveCaribeEvaluation} onSaveCaribeDraft={saveCaribeDraft} onCorrectCaribe={correctCaribeEvaluation} />}
              {activeView === 'standings' && <StandingsPage standings={standings} scoringRules={data.scoringRules} onExport={() => void handleExport()} />}
              {activeView === 'teams' && <TeamsPage teams={data.teams} canManage={canSeeAdmin} revealParticipants={canSeeAdmin} onSave={handleSaveTeam} />}
              {activeView === 'admin' && <AdminPage session={data.session} teams={data.teams} matches={data.matches} evaluations={data.evaluations} stations={data.stations} scoringRules={data.scoringRules} users={data.users} auditLogs={data.auditLogs} configured={data.configured} onGenerateSchedule={handleGenerateSchedule} onExport={handleAdminExport} onSaveStation={saveStationGuide} onSaveScoringRules={saveScoringRules} onSetUserAccess={setUserAccess} />}
            </>
          )}
        </div>
        <footer className="page-footer"><span>RUTA COLOMBIA <i /> EVENTO DEPORTIVO</span><span>Hecho para recorrer el país en equipo</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.filter((item) => ['dashboard', 'stations', 'results', 'standings', 'teams'].includes(item.id)).map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeView === id ? 'mobile-nav-active' : ''} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span></button>
        ))}
      </nav>

      {loginOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false) }}>
        <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button className="icon-button modal-close" aria-label="Cerrar" onClick={() => setLoginOpen(false)}><X size={19} /></button>
          <div className="brand-mark login-brand"><span /><span /><span /></div>
          <span className="eyebrow muted-eyebrow">ESPACIO DE COLABORADORES</span>
          <h2 id="login-title">Qué bueno tenerte de vuelta.</h2>
          <p>Inicia sesión con la cuenta asignada por la organización.</p>
          {!data.configured && <div className="notice notice-warning">La autenticación estará disponible después de configurar las variables de Firebase.</div>}
          {loginError && <div className="notice notice-error" role="alert">{loginError}</div>}
          <form onSubmit={(event) => void handleLogin(event)}>
            <label className="field-label">Correo electrónico<input name="email" type="email" autoComplete="username" required /></label>
            <label className="field-label">Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button button-primary full-button" type="submit" disabled={!data.configured}>Iniciar sesión <ArrowRight size={17} /></button>
          </form>
          <small>Los roles y las estaciones se asignan de forma segura por la administración.</small>
        </section>
      </div>}
    </div>
  )
}

function roleLabel(role: string | null) {
  if (role === 'admin') return 'Administrador'
  if (role === 'collaborator') return 'Colaborador'
  if (role === 'participant') return 'Participante'
  return 'Sin rol asignado'
}

export default App
