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
  Cookie, 
  Settings, 
  Shield, 
  Eye, 
  Database, 
  Users, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Info,
  BarChart3,
  Target,
  Globe
} from 'lucide-react'
import Link from 'next/link'

export default function CookiePolicyPage() {
  const { companyName, companyColor, settings: adminSettings } = useCompanyContext()
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState('overview')

  const sections = [
    { id: 'overview', title: 'Overview', icon: Cookie },
    { id: 'what-are-cookies', title: 'What Are Cookies', icon: Info },
    { id: 'types-of-cookies', title: 'Types of Cookies', icon: Settings },
    { id: 'essential-cookies', title: 'Essential Cookies', icon: Shield },
    { id: 'analytics-cookies', title: 'Analytics Cookies', icon: BarChart3 },
    { id: 'marketing-cookies', title: 'Marketing Cookies', icon: Target },
    { id: 'preference-cookies', title: 'Preference Cookies', icon: Settings },
    { id: 'third-party-cookies', title: 'Third-Party Cookies', icon: Globe },
    { id: 'cookie-management', title: 'Cookie Management', icon: Database },
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
                  Cookie Policy
                </h1>
                <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Cookie className="w-3 h-3" />
              <span>Cookie Information</span>
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
                      <Cookie className="w-5 h-5" />
                      <span>Cookie Policy Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                      This Cookie Policy explains how {companyName || 'Honic Co.'} uses cookies and similar technologies on our website. By using our website, you consent to the use of cookies as described in this policy.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Quick Summary:</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• We use cookies to improve your browsing experience</li>
                        <li>• You can control cookies through your browser settings</li>
                        <li>• Some cookies are essential for website functionality</li>
                        <li>• We respect your privacy and provide cookie controls</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* What Are Cookies Section */}
              {activeSection === 'what-are-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Info className="w-5 h-5" />
                      <span>What Are Cookies?</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Definition</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They help websites remember information about your visit, such as your preferred language and other settings.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>How Cookies Work</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Created when you visit a website</li>
                          <li>• Stored on your device's browser</li>
                          <li>• Sent back to the website on future visits</li>
                          <li>• Help websites remember your preferences</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Cookie Benefits</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Remember your login status</li>
                          <li>• Save your preferences</li>
                          <li>• Improve website performance</li>
                          <li>• Provide personalized content</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Important Note</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Cookies cannot access your personal files or harm your device. They only contain information that you have provided to the website or that the website can observe during your visit.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Types of Cookies Section */}
              {activeSection === 'types-of-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Settings className="w-5 h-5" />
                      <span>Types of Cookies We Use</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Shield className="w-4 h-4 mr-2 text-green-500" />
                            Essential Cookies
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Required for basic website functionality and security.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <BarChart3 className="w-4 h-4 mr-2 text-blue-500" />
                            Analytics Cookies
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Help us understand how visitors use our website.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Target className="w-4 h-4 mr-2 text-purple-500" />
                            Marketing Cookies
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Used to deliver relevant advertisements and track campaign performance.
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h4 className={cn("font-semibold text-sm mb-2 flex items-center", themeClasses.mainText)}>
                            <Settings className="w-4 h-4 mr-2 text-orange-500" />
                            Preference Cookies
                          </h4>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Remember your choices and preferences for a better experience.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Cookie Duration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-1", themeClasses.mainText)}>Session Cookies</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Deleted when you close your browser</p>
                        </div>
                        <div>
                          <h5 className={cn("font-medium text-sm mb-1", themeClasses.mainText)}>Persistent Cookies</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Remain on your device for a set period</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Essential Cookies Section */}
              {activeSection === 'essential-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Shield className="w-5 h-5" />
                      <span>Essential Cookies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>What Are Essential Cookies?</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Essential cookies are necessary for the website to function properly. These cookies cannot be disabled as they are required for basic website operations.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Authentication</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Remember your login status</li>
                          <li>• Keep you logged in across pages</li>
                          <li>• Prevent unauthorized access</li>
                          <li>• Secure session management</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Security</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Protect against CSRF attacks</li>
                          <li>• Verify form submissions</li>
                          <li>• Monitor for suspicious activity</li>
                          <li>• Ensure data integrity</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Functionality</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Shopping cart functionality</li>
                          <li>• Language preferences</li>
                          <li>• Accessibility settings</li>
                          <li>• Form data preservation</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Performance</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Load balancing</li>
                          <li>• Content delivery optimization</li>
                          <li>• Error tracking</li>
                          <li>• System monitoring</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Legal Basis</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Essential cookies are necessary for the legitimate interest of providing our services and are exempt from consent requirements under GDPR.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Analytics Cookies Section */}
              {activeSection === 'analytics-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <BarChart3 className="w-5 h-5" />
                      <span>Analytics Cookies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Purpose of Analytics Cookies</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Analytics cookies help us understand how visitors interact with our website, which pages are most popular, and how we can improve the user experience.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Collected</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Page views and visits</li>
                          <li>• Time spent on pages</li>
                          <li>• Click patterns and navigation</li>
                          <li>• Device and browser information</li>
                          <li>• Geographic location (country level)</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>How We Use This Data</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Improve website performance</li>
                          <li>• Optimize user experience</li>
                          <li>• Identify popular content</li>
                          <li>• Fix technical issues</li>
                          <li>• Plan future improvements</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Third-Party Analytics</h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Google Analytics</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            We use Google Analytics to track website usage and performance. Google Analytics uses cookies to collect information about your visits.
                          </p>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Data retention:</strong> 26 months | <strong>Opt-out:</strong> <a href="https://tools.google.com/dlpage/gaoptout" className="text-orange-500 hover:underline">Google Analytics Opt-out</a>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Privacy Protection</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Analytics data is anonymized and aggregated. We do not collect personally identifiable information through analytics cookies.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Marketing Cookies Section */}
              {activeSection === 'marketing-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Target className="w-5 h-5" />
                      <span>Marketing Cookies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Purpose of Marketing Cookies</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Marketing cookies are used to deliver relevant advertisements, track campaign performance, and measure the effectiveness of our marketing efforts.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Advertising Features</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Personalized advertisements</li>
                          <li>• Remarketing campaigns</li>
                          <li>• Cross-site tracking</li>
                          <li>• Conversion tracking</li>
                          <li>• Audience targeting</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Data Used</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Browsing behavior</li>
                          <li>• Interest categories</li>
                          <li>• Demographic information</li>
                          <li>• Purchase history</li>
                          <li>• Social media activity</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Third-Party Advertising</h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Google Ads</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            We use Google Ads to display relevant advertisements. Google uses cookies to serve ads based on your visits to our site and other sites.
                          </p>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Opt-out:</strong> <a href="https://www.google.com/settings/ads" className="text-orange-500 hover:underline">Google Ad Settings</a>
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Facebook Pixel</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            We use Facebook Pixel to track conversions and create custom audiences for advertising.
                          </p>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            <strong>Opt-out:</strong> <a href="https://www.facebook.com/ads/preferences" className="text-orange-500 hover:underline">Facebook Ad Preferences</a>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Your Choices</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        You can opt out of personalized advertising by visiting the Digital Advertising Alliance's opt-out page or adjusting your browser settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preference Cookies Section */}
              {activeSection === 'preference-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Settings className="w-5 h-5" />
                      <span>Preference Cookies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Purpose of Preference Cookies</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Preference cookies remember your choices and settings to provide a more personalized and convenient browsing experience.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Display Preferences</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Language selection</li>
                          <li>• Currency preferences</li>
                          <li>• Theme settings (dark/light mode)</li>
                          <li>• Font size preferences</li>
                          <li>• Layout preferences</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Functional Preferences</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Accessibility settings</li>
                          <li>• Notification preferences</li>
                          <li>• Search filters</li>
                          <li>• Content preferences</li>
                          <li>• Regional settings</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Examples of Preference Cookies</h4>
                      <div className="space-y-4">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Theme Cookie</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            Remembers whether you prefer dark or light mode for the website interface.
                          </p>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Cookie name:</strong> theme_preference | <strong>Duration:</strong> 1 year
                          </p>
                        </div>
                        
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Language Cookie</h5>
                          <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                            Stores your preferred language for displaying website content.
                          </p>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Cookie name:</strong> language_preference | <strong>Duration:</strong> 6 months
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Benefits</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Preference cookies enhance your user experience by remembering your choices and providing a more personalized interface.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Third-Party Cookies Section */}
              {activeSection === 'third-party-cookies' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Globe className="w-5 h-5" />
                      <span>Third-Party Cookies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>What Are Third-Party Cookies?</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Third-party cookies are set by domains other than our website. These cookies are used by external services that we integrate with to provide enhanced functionality.
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Third-Party Services We Use</h4>
                        <div className="space-y-4">
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Google Services</h5>
                            <ul className={cn("text-sm space-y-1 mb-2", themeClasses.textNeutralSecondary)}>
                              <li>• Google Analytics - Website analytics</li>
                              <li>• Google Ads - Advertising and conversion tracking</li>
                              <li>• Google Maps - Location services</li>
                              <li>• YouTube - Video content embedding</li>
                            </ul>
                            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              <strong>Privacy Policy:</strong> <a href="https://policies.google.com/privacy" className="text-orange-500 hover:underline">Google Privacy Policy</a>
                            </p>
                          </div>
                          
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Social Media</h5>
                            <ul className={cn("text-sm space-y-1 mb-2", themeClasses.textNeutralSecondary)}>
                              <li>• Facebook - Social sharing and advertising</li>
                              <li>• Instagram - Social content integration</li>
                            </ul>
                            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              <strong>Opt-out:</strong> Check individual social media platform settings
                            </p>
                          </div>
                          
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Payment Processors</h5>
                            <ul className={cn("text-sm space-y-1 mb-2", themeClasses.textNeutralSecondary)}>
                              <li>• Stripe - Payment processing</li>
                              <li>• PayPal - Payment processing</li>
                              <li>• Square - Payment processing</li>
                            </ul>
                            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              <strong>Security:</strong> All payment processors are PCI DSS compliant
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Important Notice</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Third-party cookies are subject to the privacy policies of the respective third-party services. We do not control these cookies and recommend reviewing the privacy policies of these services.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cookie Management Section */}
              {activeSection === 'cookie-management' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Database className="w-5 h-5" />
                      <span>Cookie Management</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>How to Manage Cookies</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        You have several options for managing cookies. You can control cookies through your browser settings or use our cookie consent tool.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Browser Settings</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Block all cookies</li>
                          <li>• Allow only first-party cookies</li>
                          <li>• Delete existing cookies</li>
                          <li>• Set cookie expiration</li>
                          <li>• Block specific websites</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Our Cookie Controls</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Accept all cookies</li>
                          <li>• Accept essential cookies only</li>
                          <li>• Customize cookie preferences</li>
                          <li>• Withdraw consent anytime</li>
                          <li>• Update preferences</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Browser-Specific Instructions</h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Chrome</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Settings → Privacy and security → Cookies and other site data
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Firefox</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Settings → Privacy & Security → Cookies and Site Data
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Safari</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Preferences → Privacy → Manage Website Data
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Edge</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Settings → Cookies and site permissions → Cookies and site data
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Cookie Consent Tool</h4>
                      <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                        You can manage your cookie preferences using our cookie consent tool, which allows you to:
                      </p>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• View all cookies we use</li>
                        <li>• Enable or disable cookie categories</li>
                        <li>• Update your preferences anytime</li>
                        <li>• Withdraw consent completely</li>
                      </ul>
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
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Cookie Questions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        If you have any questions about our use of cookies or this Cookie Policy, please contact us:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Mail className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>Email</p>
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
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Data Protection Officer</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        For GDPR-related cookie inquiries, you can also contact our Data Protection Officer at {process.env.NEXT_PUBLIC_DPO_EMAIL || process.env.DPO_EMAIL || process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.PRIVACY_EMAIL || 'dpo@honic.co'}
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
