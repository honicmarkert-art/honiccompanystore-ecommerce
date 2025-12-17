"use client"

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
  Clock
} from 'lucide-react'
import Link from 'next/link'

export default function GDPRCompliancePage() {
  const { companyName, companyColor, settings: adminSettings } = useCompanyContext()
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState('overview')

  const sections = [
    { id: 'overview', title: 'Overview', icon: Shield },
    { id: 'what-is-gdpr', title: 'What is GDPR', icon: FileText },
    { id: 'your-rights', title: 'Your Rights', icon: UserCheck },
    { id: 'data-controller', title: 'Data Controller', icon: Database },
    { id: 'lawful-basis', title: 'Lawful Basis', icon: Scale },
    { id: 'data-subjects', title: 'Data Subjects', icon: Users },
    { id: 'data-processing', title: 'Data Processing', icon: Settings },
    { id: 'data-transfers', title: 'Data Transfers', icon: Globe },
    { id: 'breach-notification', title: 'Breach Notification', icon: AlertTriangle },
    { id: 'dpo', title: 'Data Protection Officer', icon: Lock },
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
                  GDPR Compliance
                </h1>
                <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>GDPR Information</span>
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
                      <span>GDPR Compliance Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                      {companyName || 'Honic Co.'} is committed to full compliance with the General Data Protection Regulation (GDPR). This page outlines our GDPR compliance measures and your rights under this regulation.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Our GDPR Commitment:</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Full transparency in data processing</li>
                        <li>• Strong data protection measures</li>
                        <li>• Respect for your privacy rights</li>
                        <li>• Regular compliance monitoring</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* What is GDPR Section */}
              {activeSection === 'what-is-gdpr' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <FileText className="w-5 h-5" />
                      <span>What is GDPR?</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Definition</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        The General Data Protection Regulation (GDPR) is a comprehensive data protection law that came into effect on May 25, 2018. It applies to all organizations that process personal data of EU residents, regardless of where the organization is located.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Key Principles</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Lawfulness, fairness, and transparency</li>
                          <li>• Purpose limitation</li>
                          <li>• Data minimization</li>
                          <li>• Accuracy</li>
                          <li>• Storage limitation</li>
                          <li>• Integrity and confidentiality</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Our Compliance</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Data protection by design and default</li>
                          <li>• Privacy impact assessments</li>
                          <li>• Data breach notification procedures</li>
                          <li>• Regular staff training</li>
                          <li>• Technical and organizational measures</li>
                          <li>• Data protection officer appointment</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Territorial Scope</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        GDPR applies to our processing of personal data of EU residents, regardless of whether the processing takes place in the EU or not. We comply with GDPR requirements for all EU residents.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Your Rights Section */}
              {activeSection === 'your-rights' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <UserCheck className="w-5 h-5" />
                      <span>Your Rights Under GDPR</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Subject Rights</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        As a data subject under GDPR, you have specific rights regarding your personal data. We are committed to facilitating the exercise of these rights.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Eye className="w-4 h-4 mr-2 text-blue-500" />
                            Right of Access
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to obtain confirmation as to whether or not personal data concerning you is being processed.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Settings className="w-4 h-4 mr-2 text-green-500" />
                            Right to Rectification
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to have inaccurate personal data corrected and incomplete data completed.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                            Right to Erasure
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to have your personal data erased in certain circumstances.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Lock className="w-4 h-4 mr-2 text-purple-500" />
                            Right to Restriction
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to restrict the processing of your personal data in certain circumstances.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Database className="w-4 h-4 mr-2 text-orange-500" />
                            Right to Portability
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to receive your personal data in a structured, commonly used format.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                            Right to Object
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            You have the right to object to the processing of your personal data in certain circumstances.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>How to Exercise Your Rights</h4>
                      <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                        To exercise any of these rights, please contact us using the information provided in the Contact Us section. We will respond to your request within 30 days.
                      </p>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        <strong>Response time:</strong> 30 days (may be extended to 60 days for complex requests)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Controller Section */}
              {activeSection === 'data-controller' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Database className="w-5 h-5" />
                      <span>Data Controller Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Who We Are</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        {companyName || 'Honic Co.'} is the data controller for the personal data we process. We are responsible for determining the purposes and means of processing your personal data.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Contact Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Mail className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className={cn("text-sm font-medium", themeClasses.mainText)}>Email</p>
                              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                                {adminSettings?.contactEmail || 'privacy@honic.co'}
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
                          
                          <div className="flex items-center space-x-3">
                            <MapPin className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className={cn("text-sm font-medium", themeClasses.mainText)}>Address</p>
                              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                                {adminSettings?.address || '123 Business St, City, State 12345'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Protection Officer</h4>
                        <div className="space-y-2">
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Email:</strong> dpo@honic.co
                          </p>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Phone:</strong> +1 (555) 123-4567
                          </p>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Response time:</strong> 30 days
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Legal Entity</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {companyName || 'Honic Co.'} is a registered company with full legal responsibility for data processing activities under GDPR.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lawful Basis Section */}
              {activeSection === 'lawful-basis' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Scale className="w-5 h-5" />
                      <span>Lawful Basis for Processing</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Legal Grounds</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Under GDPR, we must have a lawful basis for processing personal data. We process your data based on the following legal grounds:
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          Consent
                        </h4>
                        <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                          We process your data when you have given clear consent for specific purposes, such as marketing communications.
                        </p>
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          <strong>Examples:</strong> Newsletter subscriptions, marketing emails, cookie preferences
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <FileText className="w-4 h-4 mr-2 text-blue-500" />
                          Contract Performance
                        </h4>
                        <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                          We process your data to perform our contractual obligations, such as providing products and services.
                        </p>
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          <strong>Examples:</strong> Order processing, payment processing, customer support
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Scale className="w-4 h-4 mr-2 text-purple-500" />
                          Legitimate Interest
                        </h4>
                        <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                          We process your data when we have a legitimate business interest that does not override your privacy rights.
                        </p>
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          <strong>Examples:</strong> Website analytics, fraud prevention, service improvement
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                          <Shield className="w-4 h-4 mr-2 text-red-500" />
                          Legal Obligation
                        </h4>
                        <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                          We process your data to comply with legal obligations, such as tax requirements or regulatory compliance.
                        </p>
                        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                          <strong>Examples:</strong> Tax records, regulatory reporting, compliance monitoring
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Your Rights</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        You have the right to withdraw consent at any time and object to processing based on legitimate interests. Contact us to exercise these rights.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Subjects Section */}
              {activeSection === 'data-subjects' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Users className="w-5 h-5" />
                      <span>Data Subjects</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Who We Process Data About</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We process personal data about various categories of individuals in the course of our business operations.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Customer Data</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Contact information (name, email, phone)</li>
                          <li>• Billing and shipping addresses</li>
                          <li>• Payment information (processed securely)</li>
                          <li>• Purchase history and preferences</li>
                          <li>• Communication records</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Website Visitors</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• IP addresses and device information</li>
                          <li>• Browsing behavior and preferences</li>
                          <li>• Cookie data and session information</li>
                          <li>• Geographic location (country level)</li>
                          <li>• Referral sources</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Business Partners</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Business contact information</li>
                          <li>• Professional details and roles</li>
                          <li>• Communication records</li>
                          <li>• Contract and agreement data</li>
                          <li>• Performance metrics</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Employees</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Personal and contact information</li>
                          <li>• Employment records and history</li>
                          <li>• Performance and evaluation data</li>
                          <li>• Training and development records</li>
                          <li>• Benefits and compensation data</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Data Minimization</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We only collect and process personal data that is necessary for the specific purposes for which it is processed, in accordance with the data minimization principle.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Processing Section */}
              {activeSection === 'data-processing' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Settings className="w-5 h-5" />
                      <span>Data Processing Activities</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Processing Purposes</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We process personal data for various legitimate business purposes, always in compliance with GDPR requirements.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Service Delivery</h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Processing orders and payments</li>
                          <li>• Providing customer support</li>
                          <li>• Managing user accounts</li>
                          <li>• Delivering products and services</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Legal basis:</strong> Contract performance, legitimate interest
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Marketing and Communications</h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Sending promotional materials</li>
                          <li>• Newsletter subscriptions</li>
                          <li>• Product recommendations</li>
                          <li>• Event invitations</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Legal basis:</strong> Consent, legitimate interest
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Analytics and Improvement</h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Website usage analysis</li>
                          <li>• Performance monitoring</li>
                          <li>• User experience optimization</li>
                          <li>• Service enhancement</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Legal basis:</strong> Legitimate interest, consent
                        </p>
                      </div>
                      
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Legal Compliance</h4>
                        <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                          <li>• Regulatory compliance</li>
                          <li>• Tax obligations</li>
                          <li>• Legal proceedings</li>
                          <li>• Fraud prevention</li>
                        </ul>
                        <p className={cn("text-xs mt-2", themeClasses.textNeutralSecondary)}>
                          <strong>Legal basis:</strong> Legal obligation, legitimate interest
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Data Protection by Design</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        All our data processing activities are designed with privacy in mind, incorporating data protection principles from the outset.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Transfers Section */}
              {activeSection === 'data-transfers' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Globe className="w-5 h-5" />
                      <span>International Data Transfers</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Cross-Border Transfers</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We may transfer your personal data to countries outside the European Economic Area (EEA) for legitimate business purposes. All transfers are conducted in compliance with GDPR requirements.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Transfer Mechanisms</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Adequacy decisions by the European Commission</li>
                          <li>• Standard Contractual Clauses (SCCs)</li>
                          <li>• Binding Corporate Rules (BCRs)</li>
                          <li>• Certification schemes</li>
                          <li>• Codes of conduct</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Encryption in transit and at rest</li>
                          <li>• Access controls and authentication</li>
                          <li>• Regular security assessments</li>
                          <li>• Data processing agreements</li>
                          <li>• Monitoring and auditing</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Third-Party Processors</h4>
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Cloud Service Providers</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            We use cloud services for data storage and processing, ensuring all providers meet GDPR requirements.
                          </p>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Examples:</strong> AWS, Google Cloud, Microsoft Azure
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Analytics Providers</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            We use analytics services to understand website usage and improve user experience.
                          </p>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Examples:</strong> Google Analytics, Adobe Analytics
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Your Rights</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        You have the right to obtain information about the safeguards we have in place for international transfers. Contact us for more details.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Breach Notification Section */}
              {activeSection === 'breach-notification' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <AlertTriangle className="w-5 h-5" />
                      <span>Data Breach Notification</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Our Breach Response</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We have comprehensive procedures in place to detect, assess, and respond to personal data breaches in accordance with GDPR requirements.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Detection and Assessment</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Automated monitoring systems</li>
                          <li>• Regular security assessments</li>
                          <li>• Incident response procedures</li>
                          <li>• Risk assessment protocols</li>
                          <li>• Impact evaluation</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Notification Requirements</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Supervisory authority: 72 hours</li>
                          <li>• Data subjects: Without undue delay</li>
                          <li>• High-risk breaches: Immediate</li>
                          <li>• Documentation: Complete records</li>
                          <li>• Follow-up: Ongoing monitoring</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Response Procedures</h4>
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Immediate Response</h5>
                          <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                            <li>• Contain the breach</li>
                            <li>• Assess the impact</li>
                            <li>• Notify relevant authorities</li>
                            <li>• Document all actions</li>
                          </ul>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Data Subject Notification</h5>
                          <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                            <li>• Clear and plain language</li>
                            <li>• Nature of the breach</li>
                            <li>• Likely consequences</li>
                            <li>• Measures taken</li>
                            <li>• Contact information</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>How to Report a Breach</h4>
                      <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                        If you become aware of a potential data breach, please contact us immediately:
                      </p>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Email: security@honic.co</li>
                        <li>• Phone: +1 (555) 123-4567</li>
                        <li>• Emergency: Available 24/7</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* DPO Section */}
              {activeSection === 'dpo' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Lock className="w-5 h-5" />
                      <span>Data Protection Officer</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Our Data Protection Officer</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We have appointed a Data Protection Officer (DPO) to oversee our GDPR compliance and serve as your point of contact for data protection matters.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>DPO Contact Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Mail className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className={cn("text-sm font-medium", themeClasses.mainText)}>Email</p>
                              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>dpo@honic.co</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Phone className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className={cn("text-sm font-medium", themeClasses.mainText)}>Phone</p>
                              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>+1 (555) 123-4567</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className={cn("text-sm font-medium", themeClasses.mainText)}>Response Time</p>
                              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Within 30 days</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>DPO Responsibilities</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Monitor GDPR compliance</li>
                          <li>• Provide data protection advice</li>
                          <li>• Conduct privacy impact assessments</li>
                          <li>• Liaise with supervisory authorities</li>
                          <li>• Handle data subject requests</li>
                          <li>• Train staff on data protection</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>When to Contact the DPO</h4>
                      <div className="space-y-3">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <h5 className={cn("font-medium text-sm mb-1", themeClasses.mainText)}>Data Subject Rights</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            For questions about your rights under GDPR, including access, rectification, erasure, and portability.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <h5 className={cn("font-medium text-sm mb-1", themeClasses.mainText)}>Privacy Concerns</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            If you have concerns about how we process your personal data or our privacy practices.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <h5 className={cn("font-medium text-sm mb-1", themeClasses.mainText)}>Compliance Questions</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            For questions about our GDPR compliance measures and data protection policies.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Independent Role</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Our DPO operates independently and reports directly to senior management. The DPO is not subject to instructions regarding the exercise of their tasks.
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
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>GDPR Questions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        If you have any questions about our GDPR compliance or need to exercise your data protection rights, please contact us:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Mail className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>General Inquiries</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {adminSettings?.contactEmail || 'privacy@honic.co'}
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
                              Within 30 days
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Data Protection Officer</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        For specific GDPR-related inquiries, you can contact our Data Protection Officer directly at dpo@honic.co
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
