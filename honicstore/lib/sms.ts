/**
 * SMS through Beem Africa (beem.africa), widely used in Tanzania. Server only.
 * Switched off until BEEM_API_KEY and BEEM_SECRET_KEY are set. BEEM_SENDER_ID is the approved sender
 * name (Beem's default "INFO" works for testing).
 */
import { logger } from '@/lib/logger'

export const smsEnabled = () => !!(process.env.BEEM_API_KEY && process.env.BEEM_SECRET_KEY)

/** to: 255XXXXXXXXX. Returns true when Beem accepted the message. */
export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!smsEnabled()) return false
  if (!/^255[67]\d{8}$/.test(to)) return false
  try {
    const auth = Buffer.from(`${process.env.BEEM_API_KEY}:${process.env.BEEM_SECRET_KEY}`).toString('base64')
    const res = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        source_addr: process.env.BEEM_SENDER_ID || 'INFO',
        schedule_time: '',
        encoding: 0,
        message: message.slice(0, 459), // 3 SMS parts max
        recipients: [{ recipient_id: 1, dest_addr: to }],
      }),
    })
    const data = await res.json().catch(() => ({}))
    const ok = res.ok && (data?.successful === true || data?.code === 100)
    if (!ok) logger.error('SMS not accepted', new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`))
    return ok
  } catch (error) {
    logger.error('SMS failed:', error)
    return false
  }
}
