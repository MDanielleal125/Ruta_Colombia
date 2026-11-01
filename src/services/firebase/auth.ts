import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth } from './authClient'
import { db } from './firestoreClient'
import type { UserRole } from '../../domain/types'

export interface SessionUser {
  uid: string
  name: string
  email: string
  role: UserRole | null
  stationIds: string[]
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase Authentication no está configurado.')
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function signOutUser(): Promise<void> {
  if (!auth) throw new Error('Firebase Authentication no está configurado.')
  await signOut(auth)
}

export function observeSession(
  onChange: (user: SessionUser | null) => void,
  onError: (error: Error) => void,
): () => void {
  const authClient = auth
  const firestore = db
  if (!authClient || !firestore) return () => undefined
  return onAuthStateChanged(authClient, async (firebaseUser) => {
    try {
      if (!firebaseUser) {
        onChange(null)
        return
      }
      const profile = await getDoc(doc(firestore, 'users', firebaseUser.uid))
      const data = profile.data()
      const role = data?.role
      onChange({
        uid: firebaseUser.uid,
        name: typeof data?.name === 'string' ? data.name : firebaseUser.displayName ?? firebaseUser.email ?? 'Usuario',
        email: firebaseUser.email ?? '',
        role: data?.active === true && (role === 'admin' || role === 'collaborator' || role === 'participant') ? role : null,
        stationIds: Array.isArray(data?.stationIds) ? data.stationIds.filter((id): id is string => typeof id === 'string') : [],
      })
    } catch (error) {
      onError(error instanceof Error ? error : new Error('No se pudo consultar el perfil del usuario.'))
    }
  }, onError)
}
