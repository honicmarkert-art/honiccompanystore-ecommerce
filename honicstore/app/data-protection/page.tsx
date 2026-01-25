"use client"

// Note: ISR (revalidate) cannot be used in client components
// CPU optimization is handled via API route caching and CDN caching instead

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCompanyContext } from '@/components/company-provider'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { 
  Shield, 
  Eye, 
  Lock, 
  Database, 
  Users, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileText,
  Scale,
  UserCheck,
  Settings,
  Globe,
  Clock,
  Key,
  Server,
  Network
} from 'lucide-react'
import Link from 'next/link'

export default function DataProtectionPage() {
  const { companyName, companyColor, settings: adminSettings } = useCompanyContext()
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState('overview')

  const sections = [
    { id: 'overview', title: 'Overview', icon: Shield },
    { id: 'data-classification', title: 'Data Classification', icon: Database },
    { id: 'security-measures', title: 'Security Measures', icon: Lock },
    { id: 'access-controls', title: 'Access Controls', icon: Key },
    { id: 'encryption', title: 'Encryption', icon: Server },
    { id: 'monitoring', title: 'Monitoring', icon: Eye },
    { id: 'incident-response', title: 'Incident Response', icon: AlertTriangle },
    { id: 'training', title: 'Staff Training', icon: Users },
    { id: 'compliance', title: 'Compliance', icon: Scale },
    { id: 'contact', title: 'Contact Us', icon: Mail }
  ]

  const themeClasses = {
    mainText: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textNeutralSecondary: theme === 'dark' ? 'text-gray-400' : 'text-gray-600',
    backgroundColor: theme === 'dark' ? 'bg-gray-900' : 'bg-white',
    borderColor: theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
  }

  return (
    <div className={cn("min-h-screen", themeClasses.backgroundColor)}>
      {/* Header */}
      <div className={cn("border-b", themeClasses.borderColor)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/home">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Home</span>
                </Button>
              </Link>
              <div>
                <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>
                  Data Protection
                </h1>
                <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Data Security</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className={cn("sticky top-8", themeClasses.backgroundColor, themeClasses.borderColor)}>
              <CardHeader>
                <CardTitle className={cn("text-lg", themeClasses.mainText)}>Contents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                        activeSection === section.id
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                          : cn("hover:bg-gray-100 dark:hover:bg-gray-800", themeClasses.textNeutralSecondary)
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{section.title}</span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-8">
              {/* Overview Section */}
              {activeSection === 'overview' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Shield className="w-5 h-5" />
                      <span>Data Protection Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                      At {companyName || 'Honic Co.'}, we implement comprehensive data protection measures to safeguard your personal information. This page outlines our data protection framework, security measures, and commitment to protecting your privacy.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Our Data Protection Framework:</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Multi-layered security architecture</li>
                        <li>• Industry-standard encryption protocols</li>
                        <li>• Regular security assessments and updates</li>
                        <li>• Comprehensive staff training programs</li>
                        <li>• Continuous monitoring and incident response</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Classification Section */}
              {activeSection === 'data-classification' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Database className="w-5 h-5" />
                      <span>Data Classification</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Categories</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We classify data based on sensitivity levels to apply appropriate protection measures and access controls.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                          Highly Sensitive Data
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Financial information (payment details, bank accounts)</li>
                          <li>• Government-issued identification numbers</li>
                          <li>• Biometric data</li>
                          <li>• Health information</li>
                          <li>• Criminal records</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Protection:</strong> Highest level encryption, restricted access, audit logging
                        </p>
                      </div>
                      
                      <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                          Sensitive Data
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Personal identification information</li>
                          <li>• Contact details (email, phone, address)</li>
                          <li>• Employment information</li>
                          <li>• Purchase history and preferences</li>
                          <li>• Communication records</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Protection:</strong> Strong encryption, access controls, regular backups
                        </p>
                      </div>
                      
                      <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                          Internal Data
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Business operations data</li>
                          <li>• Internal communications</li>
                          <li>• System logs and metrics</li>
                          <li>• Training materials</li>
                          <li>• Process documentation</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Protection:</strong> Standard encryption, access controls, retention policies
                        </p>
                      </div>
                      
                      <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          Public Data
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Public website content</li>
                          <li>• Marketing materials</li>
                          <li>• General company information</li>
                          <li>• Published research</li>
                          <li>• Open source code</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Protection:</strong> Basic security measures, content validation
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Security Measures Section */}
              {activeSection === 'security-measures' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Lock className="w-5 h-5" />
                      <span>Security Measures</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Multi-Layered Security</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We implement a comprehensive security framework with multiple layers of protection to safeguard your data against various threats.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Technical Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• End-to-end encryption (AES-256)</li>
                          <li>• Secure socket layer (SSL/TLS) certificates</li>
                          <li>• Multi-factor authentication (MFA)</li>
                          <li>• Intrusion detection systems (IDS)</li>
                          <li>• Firewall protection</li>
                          <li>• Regular security patches</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Physical Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Secure data centers with 24/7 monitoring</li>
                          <li>• Biometric access controls</li>
                          <li>• Video surveillance systems</li>
                          <li>• Environmental controls (temperature, humidity)</li>
                          <li>• Backup power systems</li>
                          <li>• Secure disposal of hardware</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Administrative Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Role-based access controls (RBAC)</li>
                          <li>• Regular security training</li>
                          <li>• Background checks for staff</li>
                          <li>• Incident response procedures</li>
                          <li>• Regular security audits</li>
                          <li>• Data retention policies</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Operational Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Continuous monitoring</li>
                          <li>• Automated threat detection</li>
                          <li>• Regular vulnerability assessments</li>
                          <li>• Penetration testing</li>
                          <li>• Security incident management</li>
                          <li>• Business continuity planning</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Security Certifications</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Our security measures are regularly audited and certified by independent third parties to ensure compliance with industry standards and best practices.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Access Controls Section */}
              {activeSection === 'access-controls' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Key className="w-5 h-5" />
                      <span>Access Controls</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Access Management</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We implement strict access controls to ensure that only authorized personnel can access personal data, and only to the extent necessary for their job functions.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Authentication</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Strong password requirements</li>
                          <li>• Multi-factor authentication (MFA)</li>
                          <li>• Single sign-on (SSO) integration</li>
                          <li>• Biometric authentication</li>
                          <li>• Hardware security keys</li>
                          <li>• Session management</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Authorization</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Role-based access control (RBAC)</li>
                          <li>• Principle of least privilege</li>
                          <li>• Attribute-based access control (ABAC)</li>
                          <li>• Dynamic access controls</li>
                          <li>• Time-based access restrictions</li>
                          <li>• Location-based access controls</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Access Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Real-time access monitoring</li>
                          <li>• Audit logging and trail</li>
                          <li>• Anomaly detection</li>
                          <li>• Access pattern analysis</li>
                          <li>• Automated alerts</li>
                          <li>• Regular access reviews</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Access Revocation</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Immediate access revocation</li>
                          <li>• Automated deprovisioning</li>
                          <li>• Exit procedures</li>
                          <li>• Account suspension</li>
                          <li>• Emergency access termination</li>
                          <li>• Regular access audits</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Zero Trust Architecture</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We implement a zero-trust security model where no user or device is trusted by default, and all access requests are verified before granting access to data.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Encryption Section */}
              {activeSection === 'encryption' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Server className="w-5 h-5" />
                      <span>Encryption</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Encryption Standards</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We use industry-standard encryption protocols to protect your data both in transit and at rest, ensuring maximum security for your personal information.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Network className="w-4 h-4 mr-2 text-blue-500" />
                          Data in Transit
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• TLS 1.3 encryption for all web traffic</li>
                          <li>• HTTPS for all website communications</li>
                          <li>• Secure email protocols (SMTPS, IMAPS)</li>
                          <li>• VPN connections for remote access</li>
                          <li>• API communications over TLS</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Protocols:</strong> TLS 1.3, HTTPS, SMTPS, IMAPS, VPN
                        </p>
                      </div>
                      
                      <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Database className="w-4 h-4 mr-2 text-green-500" />
                          Data at Rest
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• AES-256 encryption for databases</li>
                          <li>• Encrypted file storage systems</li>
                          <li>• Encrypted backup systems</li>
                          <li>• Hardware security modules (HSMs)</li>
                          <li>• Encrypted cloud storage</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Algorithms:</strong> AES-256, RSA-4096, ECC P-384
                        </p>
                      </div>
                      
                      <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Key className="w-4 h-4 mr-2 text-purple-500" />
                          Key Management
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Centralized key management system</li>
                          <li>• Regular key rotation</li>
                          <li>• Hardware security modules</li>
                          <li>• Key escrow and recovery</li>
                          <li>• Secure key distribution</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Standards:</strong> FIPS 140-2 Level 3, Common Criteria EAL4+
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Encryption Compliance</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Our encryption practices comply with industry standards including FIPS 140-2, Common Criteria, and GDPR requirements for data protection.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Monitoring Section */}
              {activeSection === 'monitoring' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Eye className="w-5 h-5" />
                      <span>Monitoring & Surveillance</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Continuous Monitoring</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We implement comprehensive monitoring systems to detect, analyze, and respond to security threats in real-time, ensuring the ongoing protection of your data.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Security Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Real-time threat detection</li>
                          <li>• Intrusion detection systems (IDS)</li>
                          <li>• Security information and event management (SIEM)</li>
                          <li>• Network traffic analysis</li>
                          <li>• Endpoint detection and response (EDR)</li>
                          <li>• Vulnerability scanning</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Data access monitoring</li>
                          <li>• Data loss prevention (DLP)</li>
                          <li>• Database activity monitoring</li>
                          <li>• File integrity monitoring</li>
                          <li>• Data classification monitoring</li>
                          <li>• Privacy impact assessments</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Performance Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• System performance metrics</li>
                          <li>• Application performance monitoring</li>
                          <li>• Infrastructure monitoring</li>
                          <li>• Capacity planning</li>
                          <li>• Service level monitoring</li>
                          <li>• Availability monitoring</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Compliance Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Regulatory compliance tracking</li>
                          <li>• Policy compliance monitoring</li>
                          <li>• Audit trail maintenance</li>
                          <li>• Risk assessment monitoring</li>
                          <li>• Control effectiveness testing</li>
                          <li>• Reporting and analytics</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>24/7 Security Operations Center</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Our Security Operations Center (SOC) operates 24/7 to monitor, detect, and respond to security incidents, ensuring continuous protection of your data.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Incident Response Section */}
              {activeSection === 'incident-response' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <AlertTriangle className="w-5 h-5" />
                      <span>Incident Response</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Incident Response Plan</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We have a comprehensive incident response plan to quickly detect, contain, and recover from security incidents, minimizing impact on your data and our services.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Clock className="w-4 h-4 mr-2 text-red-500" />
                          Detection & Analysis
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Automated threat detection</li>
                          <li>• Security monitoring alerts</li>
                          <li>• Incident classification</li>
                          <li>• Impact assessment</li>
                          <li>• Severity determination</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Timeline:</strong> Immediate detection and analysis
                        </p>
                      </div>
                      
                      <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Shield className="w-4 h-4 mr-2 text-orange-500" />
                          Containment & Eradication
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Immediate containment measures</li>
                          <li>• System isolation</li>
                          <li>• Threat eradication</li>
                          <li>• Evidence preservation</li>
                          <li>• System restoration</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Timeline:</strong> Within 1 hour of detection
                        </p>
                      </div>
                      
                      <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Users className="w-4 h-4 mr-2 text-yellow-500" />
                          Notification & Communication
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Internal team notification</li>
                          <li>• Management escalation</li>
                          <li>• Customer notification (if required)</li>
                          <li>• Regulatory notification</li>
                          <li>• Public communication</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Timeline:</strong> Within 24 hours of incident
                        </p>
                      </div>
                      
                      <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          Recovery & Lessons Learned
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• System recovery and validation</li>
                          <li>• Service restoration</li>
                          <li>• Post-incident review</li>
                          <li>• Process improvements</li>
                          <li>• Training updates</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Timeline:</strong> Within 72 hours of incident
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Emergency Contacts</h4>
                      <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                        For security incidents or data breaches, contact our incident response team:
                      </p>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Emergency hotline: +1 (555) 911-SECURITY</li>
                        <li>• Email: {process.env.NEXT_PUBLIC_SECURITY_EMAIL || process.env.SECURITY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'security@honic.co'}</li>
                        <li>• 24/7 availability</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Training Section */}
              {activeSection === 'training' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Users className="w-5 h-5" />
                      <span>Staff Training</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Training Program</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We provide comprehensive data protection training to all staff members to ensure they understand their responsibilities and can effectively protect your personal data.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Training Topics</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Data protection principles</li>
                          <li>• GDPR compliance requirements</li>
                          <li>• Security best practices</li>
                          <li>• Incident response procedures</li>
                          <li>• Privacy by design</li>
                          <li>• Data subject rights</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Training Methods</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Interactive online modules</li>
                          <li>• Hands-on workshops</li>
                          <li>• Scenario-based training</li>
                          <li>• Regular refresher courses</li>
                          <li>• Role-specific training</li>
                          <li>• Certification programs</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Training Frequency</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• New employee orientation</li>
                          <li>• Annual mandatory training</li>
                          <li>• Quarterly updates</li>
                          <li>• Incident-based training</li>
                          <li>• Regulatory updates</li>
                          <li>• Continuous learning</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Assessment & Certification</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Knowledge assessments</li>
                          <li>• Practical exercises</li>
                          <li>• Certification requirements</li>
                          <li>• Performance monitoring</li>
                          <li>• Competency evaluations</li>
                          <li>• Continuous improvement</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Training Effectiveness</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We regularly assess the effectiveness of our training programs and update them based on emerging threats, regulatory changes, and industry best practices.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Compliance Section */}
              {activeSection === 'compliance' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Scale className="w-5 h-5" />
                      <span>Compliance & Auditing</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Compliance Framework</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We maintain compliance with various data protection regulations and industry standards through regular audits, assessments, and continuous monitoring.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <FileText className="w-4 h-4 mr-2 text-blue-500" />
                          Regulatory Compliance
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• GDPR (General Data Protection Regulation)</li>
                          <li>• CCPA (California Consumer Privacy Act)</li>
                          <li>• PIPEDA (Personal Information Protection and Electronic Documents Act)</li>
                          <li>• HIPAA (Health Insurance Portability and Accountability Act)</li>
                          <li>• SOX (Sarbanes-Oxley Act)</li>
                        </ul>
                      </div>
                      
                      <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Shield className="w-4 h-4 mr-2 text-green-500" />
                          Industry Standards
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• ISO 27001 (Information Security Management)</li>
                          <li>• ISO 27018 (Cloud Privacy)</li>
                          <li>• SOC 2 Type II (Service Organization Control)</li>
                          <li>• PCI DSS (Payment Card Industry Data Security Standard)</li>
                          <li>• NIST Cybersecurity Framework</li>
                        </ul>
                      </div>
                      
                      <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Eye className="w-4 h-4 mr-2 text-purple-500" />
                          Auditing & Assessment
                        </h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Annual third-party audits</li>
                          <li>• Internal compliance assessments</li>
                          <li>• Penetration testing</li>
                          <li>• Vulnerability assessments</li>
                          <li>• Risk assessments</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Compliance Monitoring</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Continuous compliance monitoring</li>
                          <li>• Automated compliance checks</li>
                          <li>• Regular policy reviews</li>
                          <li>• Control effectiveness testing</li>
                          <li>• Compliance reporting</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Certification Maintenance</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Annual certification renewals</li>
                          <li>• Ongoing compliance training</li>
                          <li>• Regular security updates</li>
                          <li>• Process improvements</li>
                          <li>• Documentation maintenance</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Compliance Certificates</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Our compliance certificates and audit reports are available upon request. Contact us for copies of our latest compliance documentation.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Section */}
              {activeSection === 'contact' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Mail className="w-5 h-5" />
                      <span>Contact Us</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Protection Questions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        If you have any questions about our data protection measures or need to report a security concern, please contact us:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Mail className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>General Inquiries</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {adminSettings?.contactEmail || process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.PRIVACY_EMAIL || process.env.NEXT_PUBLIC_LEGAL_EMAIL || process.env.LEGAL_EMAIL || 'privacy@honic.co'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Phone className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>Phone</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {adminSettings?.contactPhone || '+1 (555) 123-4567'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>Address</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {adminSettings?.address || '123 Business St, City, State 12345'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>Response Time</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              Within 24 hours
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Security Hotline</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        For urgent security concerns or to report a potential data breach, call our 24/7 security hotline: +1 (555) 911-SECURITY
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
