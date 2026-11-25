import { z } from 'zod'

/**
 * Shared zod instance — import `{ z } from '@/lib/zod'` instead of 'zod'.
 *
 * zod 4 changed the default message for a missing field to
 * "Invalid input: expected string, received undefined". This restores zod 3's plain
 * "Required" for that case. Messages written on a schema (e.g. 'Name is required')
 * still take priority; every other default message is left unchanged.
 */
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) return 'Required'
    return undefined // fall back to zod's default message
  },
})

export { z }
