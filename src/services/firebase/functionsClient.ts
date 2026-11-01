import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { app } from './app'
import { EMULATORS, FUNCTIONS_REGION, useEmulators } from './config'

export const functions = app ? getFunctions(app, FUNCTIONS_REGION) : null

if (functions && useEmulators) {
  connectFunctionsEmulator(functions, EMULATORS.host, EMULATORS.functionsPort)
}
