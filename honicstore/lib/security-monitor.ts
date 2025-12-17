import { logger } from '@/lib/logger'

interface SecurityEvent {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY' | 'PAYMENT_ATTEMPT' | 'ADMIN_ACCESS'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  details: any
  timestamp: string
  ip: string
  userAgent?: string
  userId?: string
}

class SecurityMonitor {
  private static instance: SecurityMonitor
  private events: SecurityEvent[] = []
  private maxEvents = 1000 // Keep last 1000 events in memory

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor()
    }
    return SecurityMonitor.instance
  }

  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }

    this.events.unshift(securityEvent)
    
    // Keep only the latest events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.log(`[SECURITY MONITOR] ${event.type} - ${event.severity}`, securityEvent)
    }

    // In production, send to monitoring service
    this.sendToMonitoringService(securityEvent)
  }

  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(0, limit)
  }

  getEventsByType(type: SecurityEvent['type'], limit: number = 50): SecurityEvent[] {
    return this.events.filter(event => event.type === type).slice(0, limit)
  }

  getEventsBySeverity(severity: SecurityEvent['severity'], limit: number = 50): SecurityEvent[] {
    return this.events.filter(event => event.severity === severity).slice(0, limit)
  }

  getEventsByIP(ip: string, limit: number = 50): SecurityEvent[] {
    return this.events.filter(event => event.ip === ip).slice(0, limit)
  }

  // Check for suspicious patterns
  detectSuspiciousActivity(ip: string): boolean {
    const recentEvents = this.getEventsByIP(ip, 100)
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    // Check for multiple failed auth attempts
    const authFailures = recentEvents.filter(event => 
      event.type === 'AUTH_FAILURE' && 
      (now - new Date(event.timestamp).getTime()) < oneHour
    )

    // Check for rate limit violations
    const rateLimitViolations = recentEvents.filter(event => 
      event.type === 'RATE_LIMIT' && 
      (now - new Date(event.timestamp).getTime()) < oneHour
    )

    // Check for multiple admin access attempts
    const adminAccess = recentEvents.filter(event => 
      event.type === 'ADMIN_ACCESS' && 
      (now - new Date(event.timestamp).getTime()) < oneHour
    )

    // Flag as suspicious if:
    // - More than 5 auth failures in 1 hour
    // - More than 3 rate limit violations in 1 hour
    // - More than 10 admin access attempts in 1 hour
    if (authFailures.length > 5 || rateLimitViolations.length > 3 || adminAccess.length > 10) {
      this.logEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        details: {
          authFailures: authFailures.length,
          rateLimitViolations: rateLimitViolations.length,
          adminAccess: adminAccess.length,
          reason: 'Multiple security violations detected'
        },
        ip
      })
      return true
    }

    return false
  }

  private sendToMonitoringService(event: SecurityEvent): void {
    // In production, implement actual monitoring service integration
    // Examples: Sentry, DataDog, CloudWatch, etc.
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external monitoring service
      // fetch('https://your-monitoring-service.com/api/security-events', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // }).catch(console.error)
    }
  }
}

export const securityMonitor = SecurityMonitor.getInstance()

// Helper functions for common security events
export function logAuthFailure(details: any, ip: string, userAgent?: string, userId?: string): void {
  securityMonitor.logEvent({
    type: 'AUTH_FAILURE',
    severity: 'MEDIUM',
    details,
    ip,
    userAgent,
    userId
  })
}

export function logRateLimit(details: any, ip: string, userAgent?: string): void {
  securityMonitor.logEvent({
    type: 'RATE_LIMIT',
    severity: 'MEDIUM',
    details,
    ip,
    userAgent
  })
}

export function logPaymentAttempt(details: any, ip: string, userAgent?: string, userId?: string): void {
  securityMonitor.logEvent({
    type: 'PAYMENT_ATTEMPT',
    severity: 'HIGH',
    details,
    ip,
    userAgent,
    userId
  })
}

export function logAdminAccess(details: any, ip: string, userAgent?: string, userId?: string): void {
  securityMonitor.logEvent({
    type: 'ADMIN_ACCESS',
    severity: 'HIGH',
    details,
    ip,
    userAgent,
    userId
  })
}








