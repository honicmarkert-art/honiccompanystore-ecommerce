// ESLint flat config (Next.js 16 removed `next lint` and the legacy .eslintrc format).
// Same rule sets as the old .eslintrc.json: next/core-web-vitals + next/typescript.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'scripts/**'] },
]

export default config
