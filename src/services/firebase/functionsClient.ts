import { getFunctions } from 'firebase/functions'
import { app } from './app'

export const functions = app ? getFunctions(app, 'southamerica-east1') : null
