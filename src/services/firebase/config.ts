const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(config).every(Boolean)
export { config as firebaseConfig }

const isLocalHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

const emulatorsRequested = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

// DEV es false en `vite build`, por lo que el flag nunca se activa en producción.
export const useEmulators = import.meta.env.DEV && emulatorsRequested && isLocalHost

if (emulatorsRequested && !useEmulators) {
  console.warn('VITE_USE_FIREBASE_EMULATORS ignorado: solo aplica en desarrollo local.')
}

export const EMULATORS = {
  host: '127.0.0.1',
  authPort: 9099,
  firestorePort: 8080,
  functionsPort: 5001,
} as const

export const FUNCTIONS_REGION = 'southamerica-east1'
