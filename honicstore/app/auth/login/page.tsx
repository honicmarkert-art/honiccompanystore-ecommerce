import type { Metadata } from 'next'
import { AuthPage } from '../_components/auth-page'

export const metadata: Metadata = { title: 'Sign in | Honic Store' }

export default function LoginPage() {
  return <AuthPage tab="login" />
}
