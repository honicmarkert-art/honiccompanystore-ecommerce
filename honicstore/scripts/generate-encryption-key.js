/**
 * Generate a secure encryption key for payout accounts
 * 
 * Usage:
 *   node scripts/generate-encryption-key.js
 * 
 * This will generate a secure 32-byte (256-bit) key for AES-256 encryption
 */

const crypto = require('crypto')

// Generate a secure random key (32 bytes = 256 bits for AES-256)
const key = crypto.randomBytes(32).toString('base64')

console.log('\n' + '='.repeat(60))
console.log('🔐 Secure Encryption Key Generated')
console.log('='.repeat(60))
console.log('\nAdd this to your .env.local file:\n')
console.log(`PAYOUT_ENCRYPTION_KEY=${key}\n`)
console.log('='.repeat(60))
console.log('\n⚠️  IMPORTANT SECURITY NOTES:')
console.log('   1. Keep this key SECRET - never commit it to version control')
console.log('   2. Store it securely in your environment variables')
console.log('   3. Use different keys for development and production')
console.log('   4. If the key is lost, encrypted data cannot be recovered')
console.log('\n')


