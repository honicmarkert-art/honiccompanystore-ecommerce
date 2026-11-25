import type { Metadata } from 'next'
import { AuthPage } from '../_components/auth-page'

export const metadata: Metadata = { title: 'Create account | Honic Store' }

export default function RegisterPage() {
  return <AuthPage tab="register" />
}
