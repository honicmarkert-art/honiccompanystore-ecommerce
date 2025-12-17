"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  CheckCircle,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react'

function PrivacyPolicyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { companyName, companyColor, settings: adminSettings } = useCompanyContext()
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState('overview')
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  useEffect(() => {
    // Get return URL from query params or sessionStorage
    const urlParam = searchParams.get('return')
    if (urlParam) {
      setReturnUrl(urlParam)
      // Also store in sessionStorage as backup
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('privacy_return_url', urlParam)
      }
    } else if (typeof window !== 'undefined') {
      // Check sessionStorage for stored return URL
      const stored = sessionStorage.getItem('privacy_return_url')
      if (stored) {
        setReturnUrl(stored)
      }
    }
  }, [searchParams])

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      // First priority: Use return URL from params or sessionStorage
      if (returnUrl) {
        sessionStorage.removeItem('privacy_return_url')
        router.push(returnUrl)
        return
      }
      
      // Second priority: Check referrer
      const referrer = document.referrer
      if (referrer && referrer !== window.location.href) {
        // Extract pathname from referrer
        try {
          const referrerUrl = new URL(referrer)
          const referrerPath = referrerUrl.pathname
          // Only go back if referrer is from same origin
          if (referrerUrl.origin === window.location.origin && referrerPath !== '/privacy') {
            window.history.back()
            return
          }
        } catch (e) {
          // If URL parsing fails, try history.back()
          window.history.back()
          return
        }
      }
      
      // Fallback: Go to home
      router.push('/')
    } else {
      router.push('/')
    }
  }

  const sections = [
    { id: 'overview', title: 'Overview', icon: Shield },
    { id: 'data-collection', title: 'Data Collection', icon: Database },
    { id: 'data-usage', title: 'Data Usage', icon: Eye },
    { id: 'data-sharing', title: 'Data Sharing', icon: Users },
    { id: 'data-security', title: 'Data Security', icon: Lock },
    { id: 'your-rights', title: 'Your Rights', icon: CheckCircle },
    { id: 'cookies', title: 'Cookies', icon: AlertTriangle },
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
              <Button variant="ghost" size="sm" className="flex items-center space-x-2" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>
                  Privacy Policy
                </h1>
                <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Legal Document</span>
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
                      <span>Privacy Policy Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                      At {companyName || 'Honic Co.'}, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Key Points:</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• We collect only necessary information to provide our services</li>
                        <li>• Your data is protected with industry-standard security measures</li>
                        <li>• We never sell your personal information to third parties</li>
                        <li>• You have full control over your data and can request its deletion</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Collection Section */}
              {activeSection === 'data-collection' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Database className="w-5 h-5" />
                      <span>Information We Collect</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Personal Information</h4>
                      <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                        <li>• <strong>Account Information:</strong> Name, email address, phone number</li>
                        <li>• <strong>Profile Data:</strong> Profile picture, preferences, settings</li>
                        <li>• <strong>Contact Information:</strong> Shipping and billing addresses</li>
                        <li>• <strong>Payment Information:</strong> Payment methods (securely processed by third-party providers)</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Usage Information</h4>
                      <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                        <li>• <strong>Website Activity:</strong> Pages visited, time spent, click patterns</li>
                        <li>• <strong>Device Information:</strong> IP address, browser type, operating system</li>
                        <li>• <strong>Location Data:</strong> General geographic location (country/region level)</li>
                        <li>• <strong>Cookies:</strong> Session cookies and preference cookies</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Business Information</h4>
                      <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                        <li>• <strong>Company Details:</strong> Business name, industry, company size</li>
                        <li>• <strong>Order History:</strong> Purchase records, product preferences</li>
                        <li>• <strong>Communication Records:</strong> Support tickets, email correspondence</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Usage Section */}
              {activeSection === 'data-usage' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Eye className="w-5 h-5" />
                      <span>How We Use Your Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Service Delivery</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Process orders and payments</li>
                          <li>• Provide customer support</li>
                          <li>• Send order confirmations</li>
                          <li>• Track shipments</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Communication</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Send newsletters (with consent)</li>
                          <li>• Provide product updates</li>
                          <li>• Share promotional offers</li>
                          <li>• Respond to inquiries</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Analytics</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Improve website performance</li>
                          <li>• Analyze user behavior</li>
                          <li>• Optimize user experience</li>
                          <li>• Generate insights</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Legal Compliance</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Comply with regulations</li>
                          <li>• Prevent fraud</li>
                          <li>• Enforce terms of service</li>
                          <li>• Protect our rights</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Sharing Section */}
              {activeSection === 'data-sharing' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Users className="w-5 h-5" />
                      <span>Information Sharing</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2 text-green-800 dark:text-green-400", themeClasses.mainText)}>We DO NOT sell your personal information</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We never sell, rent, or trade your personal information to third parties for marketing purposes.
                      </p>
                    </div>

                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>When We Share Information</h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Service Providers</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            We share information with trusted third-party service providers who help us operate our business, such as payment processors, shipping companies, and analytics providers.
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Legal Requirements</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            We may disclose information when required by law, court order, or to protect our rights and the safety of our users.
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Business Transfers</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            In the event of a merger, acquisition, or sale of assets, user information may be transferred as part of the business transaction.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Security Section */}
              {activeSection === 'data-security' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Lock className="w-5 h-5" />
                      <span>Data Security</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Technical Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• SSL/TLS encryption for data transmission</li>
                          <li>• Encrypted data storage</li>
                          <li>• Regular security audits</li>
                          <li>• Secure server infrastructure</li>
                          <li>• Multi-factor authentication</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Administrative Safeguards</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Limited access to personal data</li>
                          <li>• Employee training on data protection</li>
                          <li>• Regular access reviews</li>
                          <li>• Incident response procedures</li>
                          <li>• Data retention policies</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Data Breach Response</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        In the unlikely event of a data breach, we will notify affected users within 72 hours and take immediate steps to secure the compromised systems.
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
                      <CheckCircle className="w-5 h-5" />
                      <span>Your Rights</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Access & Portability</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Request a copy of your data</li>
                          <li>• Export your data in a portable format</li>
                          <li>• View what information we have about you</li>
                          <li>• Understand how we use your data</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Correction & Deletion</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Correct inaccurate information</li>
                          <li>• Update your personal details</li>
                          <li>• Request data deletion</li>
                          <li>• Withdraw consent</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Restriction & Objection</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Restrict data processing</li>
                          <li>• Object to certain uses</li>
                          <li>• Opt-out of marketing</li>
                          <li>• Unsubscribe from emails</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Complaints</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• File a complaint with us</li>
                          <li>• Contact data protection authorities</li>
                          <li>• Seek legal remedies</li>
                          <li>• Report privacy concerns</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>How to Exercise Your Rights</h4>
                      <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                        To exercise any of these rights, please contact us using the information provided in the Contact Us section.
                      </p>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We will respond to your request within 30 days and may require identity verification for security purposes.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cookies Section */}
              {activeSection === 'cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <AlertTriangle className="w-5 h-5" />
                      <span>Cookies and Tracking</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>What Are Cookies?</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Cookies are small text files stored on your device that help us provide a better user experience and analyze website traffic.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Essential Cookies</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Session management</li>
                          <li>• Shopping cart functionality</li>
                          <li>• User authentication</li>
                          <li>• Security features</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Analytics Cookies</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Website performance analysis</li>
                          <li>• User behavior tracking</li>
                          <li>• Traffic source identification</li>
                          <li>• Conversion tracking</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Preference Cookies</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Language preferences</li>
                          <li>• Theme settings</li>
                          <li>• Display preferences</li>
                          <li>• Customization options</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Marketing Cookies</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Personalized advertising</li>
                          <li>• Social media integration</li>
                          <li>• Remarketing campaigns</li>
                          <li>• Cross-site tracking</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Cookie Management</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        You can control cookies through your browser settings. However, disabling certain cookies may affect website functionality.
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
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Privacy Questions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        If you have any questions about this Privacy Policy or our data practices, please contact us:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
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
                        For GDPR-related inquiries, you can also contact our Data Protection Officer at dpo@honic.co
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

export default function PrivacyPolicyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PrivacyPolicyPageContent />
    </Suspense>
  )
}
