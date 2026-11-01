import { getAuth } from 'firebase/auth'
import { app } from './app'

export const auth = app ? getAuth(app) : null
