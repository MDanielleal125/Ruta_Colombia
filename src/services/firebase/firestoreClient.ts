import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { app, isExistingFirebaseApp } from './app'

export const db = app
  ? isExistingFirebaseApp ? getFirestore(app) : initializeFirestore(app, { localCache: persistentLocalCache() })
  : null
