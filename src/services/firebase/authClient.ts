import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { app } from './app'
import { EMULATORS, useEmulators } from './config'

export const auth = app ? getAuth(app) : null

if (auth && useEmulators) {
  connectAuthEmulator(auth, `http://${EMULATORS.host}:${EMULATORS.authPort}`)
}
