import { getApp, getApps, initializeApp } from 'firebase/app'
import { firebaseConfig, isFirebaseConfigured } from './config'

export const isExistingFirebaseApp = getApps().length > 0
export const app = isFirebaseConfigured
  ? isExistingFirebaseApp ? getApp() : initializeApp(firebaseConfig)
  : null
