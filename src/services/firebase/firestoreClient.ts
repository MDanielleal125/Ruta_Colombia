import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
} from 'firebase/firestore'
import { app, isExistingFirebaseApp } from './app'
import { EMULATORS, useEmulators } from './config'

export const db = app
  ? isExistingFirebaseApp
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: useEmulators ? memoryLocalCache() : persistentLocalCache(),
      })
  : null

if (db && useEmulators) {
  connectFirestoreEmulator(db, EMULATORS.host, EMULATORS.firestorePort)
}
