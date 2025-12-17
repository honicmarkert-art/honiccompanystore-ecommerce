import { NextRequest } from 'next/server'
import { logger } from './logger'

/**
 * Security Monitoring and Logging System
 * Tracks suspicious activities and potential attacks
 */

export interface SecurityEvent {
  type: 'idor_attempt' | 'rate_limit_exceeded' | 'suspicious_pattern' | 'unauthorized_access' | 'admin_action'
  userId?: string
  ip: string
  userAgent: string
  timestamp: string
  details: any
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface MonitoringConfig {
  enableRealTimeAlerts: boolean
  enablePatternDetection: boolean
  enableRateLimitMonitoring: boolean
  alertThresholds: {
    idorAttempts: number
    rateLimitViolations: number
    suspiciousPatterns: number
  }
  retentionDays: number
}

const defaultConfig: MonitoringConfig = {
  enableRealTimeAlerts: true,
  enablePatternDetection: true,
  enableRateLimitMonitoring: true,
  alertThresholds: {
    idorAttempts: 5,
    rateLimitViolations: 10,
    suspiciousPatterns: 3
  },
  retentionDays: 30
}

// In-memory stores (use Redis in production)
const userActivityLog = new Map<string, SecurityEvent[]>()
const ipActivityLog = new Map<string, SecurityEvent[]>()
const alertQueue: SecurityEvent[] = []

/**
 * Log security event
 */
export function logSecurityEvent(
  event: SecurityEvent,
  config: MonitoringConfig = defaultConfig
): void {
  // Add to user activity log
  if (event.userId) {
    if (!userActivityLog.has(event.userId)) {
      userActivityLog.set(event.userId, [])
    }
    userActivityLog.get(event.userId)!.push(event)
  }
  
  // Add to IP activity log
  if (!ipActivityLog.has(event.ip)) {
    ipActivityLog.set(event.ip, [])
  }
  ipActivityLog.get(event.ip)!.push(event)
  
  // Add to alert queue if high severity
  if (event.severity === 'high' || event.severity === 'critical') {
    alertQueue.push(event)
  }
  
  // Log to system logger
  logger.security(`Security Event: ${event.type}`, event.userId, {
    ip: event.ip,
    userAgent: event.userAgent,
    severity: event.severity,
    details: event.details
  })
}

/**
 * Detect suspicious patterns
 */
export function detectSuspiciousPatterns(
  userId: string,
  config: MonitoringConfig = defaultConfig
): SecurityEvent[] {
  if (!config.enablePatternDetection) return []
  
  const userEvents = userActivityLog.get(userId) || []
  const suspiciousEvents: SecurityEvent[] = []
  
  // Detect rapid sequential ID access
  const idorEvents = userEvents.filter(e => e.type === 'idor_attempt')
  if (idorEvents.length >= config.alertThresholds.idorAttempts) {
    suspiciousEvents.push({
      type: 'suspicious_pattern',
      userId,
      ip: idorEvents[0].ip,
      userAgent: idorEvents[0].userAgent,
      timestamp: new Date().toISOString(),
      details: {
        pattern: 'sequential_idor_attempts',
        count: idorEvents.length,
        threshold: config.alertThresholds.idorAttempts
      },
      severity: 'high'
    })
  }
  
  // Detect rate limit violations
  const rateLimitEvents = userEvents.filter(e => e.type === 'rate_limit_exceeded')
  if (rateLimitEvents.length >= config.alertThresholds.rateLimitViolations) {
    suspiciousEvents.push({
      type: 'suspicious_pattern',
      userId,
      ip: rateLimitEvents[0].ip,
      userAgent: rateLimitEvents[0].userAgent,
      timestamp: new Date().toISOString(),
      details: {
        pattern: 'excessive_rate_limit_violations',
        count: rateLimitEvents.length,
        threshold: config.alertThresholds.rateLimitViolations
      },
      severity: 'medium'
    })
  }
  
  return suspiciousEvents
}

/**
 * Monitor user activity for anomalies
 */
export function monitorUserActivity(
  userId: string,
  request: NextRequest,
  action: string,
  config: MonitoringConfig = defaultConfig
): void {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Check for suspicious patterns
  const suspiciousEvents = detectSuspiciousPatterns(userId, config)
  
  // Log each suspicious event
  suspiciousEvents.forEach(event => {
    logSecurityEvent(event, config)
  })
  
  // Log the current action
  logSecurityEvent({
    type: 'admin_action',
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    details: { action },
    severity: 'low'
  }, config)
}

/**
 * Monitor IDOR attempts
 */
export function monitorIdorAttempt(
  userId: string,
  request: NextRequest,
  resourceId: string,
  resourceType: string,
  success: boolean,
  config: MonitoringConfig = defaultConfig
): void {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  logSecurityEvent({
    type: 'idor_attempt',
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    details: {
      resourceId,
      resourceType,
      success,
      attemptType: success ? 'successful' : 'blocked'
    },
    severity: success ? 'low' : 'medium'
  }, config)
}

/**
 * Monitor rate limit violations
 */
export function monitorRateLimitViolation(
  userId: string,
  request: NextRequest,
  endpoint: string,
  limit: number,
  config: MonitoringConfig = defaultConfig
): void {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  logSecurityEvent({
    type: 'rate_limit_exceeded',
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    details: {
      endpoint,
      limit,
      violationType: 'rate_limit_exceeded'
    },
    severity: 'medium'
  }, config)
}

/**
 * Monitor unauthorized access attempts
 */
export function monitorUnauthorizedAccess(
  userId: string,
  request: NextRequest,
  resource: string,
  reason: string,
  config: MonitoringConfig = defaultConfig
): void {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  logSecurityEvent({
    type: 'unauthorized_access',
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    details: {
      resource,
      reason,
      accessType: 'unauthorized'
    },
    severity: 'high'
  }, config)
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (remoteAddr) {
    return remoteAddr
  }
  
  return 'unknown'
}

/**
 * Generate security report
 */
export function generateSecurityReport(
  userId?: string,
  timeRange: { start: Date; end: Date } = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  }
): {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  suspiciousUsers: string[]
  topIPs: Array<{ ip: string; count: number }>
} {
  const allEvents: SecurityEvent[] = []
  
  // Collect events from user logs
  if (userId) {
    const userEvents = userActivityLog.get(userId) || []
    allEvents.push(...userEvents)
  } else {
    // Collect all events
    for (const events of userActivityLog.values()) {
      allEvents.push(...events)
    }
  }
  
  // Filter by time range
  const filteredEvents = allEvents.filter(event => {
    const eventTime = new Date(event.timestamp)
    return eventTime >= timeRange.start && eventTime <= timeRange.end
  })
  
  // Generate statistics
  const eventsByType: Record<string, number> = {}
  const eventsBySeverity: Record<string, number> = {}
  const ipCounts: Record<string, number> = {}
  
  filteredEvents.forEach(event => {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
    eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
    ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1
  })
  
  // Find suspicious users
  const suspiciousUsers: string[] = []
  for (const [userId, events] of userActivityLog.entries()) {
    const recentEvents = events.filter(e => {
      const eventTime = new Date(e.timestamp)
      return eventTime >= timeRange.start && eventTime <= timeRange.end
    })
    
    const suspiciousCount = recentEvents.filter(e => 
      e.type === 'idor_attempt' || e.type === 'suspicious_pattern'
    ).length
    
    if (suspiciousCount >= 3) {
      suspiciousUsers.push(userId)
    }
  }
  
  // Get top IPs
  const topIPs = Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  
  return {
    totalEvents: filteredEvents.length,
    eventsByType,
    eventsBySeverity,
    suspiciousUsers,
    topIPs
  }
}

/**
 * Get alerts that need attention
 */
export function getPendingAlerts(): SecurityEvent[] {
  return alertQueue.slice() // Return copy
}

/**
 * Clear processed alerts
 */
export function clearProcessedAlerts(): void {
  alertQueue.length = 0
}

/**
 * Clean up old data
 */
export function cleanupOldData(retentionDays: number = 30): void {
  const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  
  // Clean user activity logs
  for (const [userId, events] of userActivityLog.entries()) {
    const filteredEvents = events.filter(event => 
      new Date(event.timestamp) > cutoffTime
    )
    
    if (filteredEvents.length === 0) {
      userActivityLog.delete(userId)
    } else {
      userActivityLog.set(userId, filteredEvents)
    }
  }
  
  // Clean IP activity logs
  for (const [ip, events] of ipActivityLog.entries()) {
    const filteredEvents = events.filter(event => 
      new Date(event.timestamp) > cutoffTime
    )
    
    if (filteredEvents.length === 0) {
      ipActivityLog.delete(ip)
    } else {
      ipActivityLog.set(ip, filteredEvents)
    }
  }
}

/**
 * Export security data for analysis
 */
export function exportSecurityData(): {
  userActivity: Record<string, SecurityEvent[]>
  ipActivity: Record<string, SecurityEvent[]>
  alerts: SecurityEvent[]
} {
  return {
    userActivity: Object.fromEntries(userActivityLog),
    ipActivity: Object.fromEntries(ipActivityLog),
    alerts: alertQueue.slice()
  }
}

// Clean up old data every hour
setInterval(() => cleanupOldData(), 3600000)
