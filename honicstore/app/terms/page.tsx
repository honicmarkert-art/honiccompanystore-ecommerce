"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCompanyContext } from '@/components/company-provider'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { 
  FileText, 
  User, 
  ShoppingCart, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  ArrowLeft,
  Scale,
  CreditCard,
  Truck,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'

export default function TermsOfServicePage() {
  const { companyName, companyColor, settings: adminSettings } = useCompanyContext()
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState('overview')

  const sections = [
    { id: 'overview', title: 'Overview', icon: FileText },
    { id: 'acceptance', title: 'Acceptance', icon: CheckCircle },
    { id: 'user-accounts', title: 'User Accounts', icon: User },
    { id: 'products-services', title: 'Products & Services', icon: ShoppingCart },
    { id: 'payments', title: 'Payments', icon: CreditCard },
    { id: 'shipping-returns', title: 'Shipping & Returns', icon: Truck },
    { id: 'intellectual-property', title: 'Intellectual Property', icon: Scale },
    { id: 'prohibited-uses', title: 'Prohibited Uses', icon: AlertTriangle },
    { id: 'disclaimers', title: 'Disclaimers', icon: Shield },
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
                  Terms of Service
                </h1>
                <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <FileText className="w-3 h-3" />
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
                      <FileText className="w-5 h-5" />
                      <span>Terms of Service Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                      Welcome to {companyName || 'Honic Co.'}. These Terms of Service ("Terms") govern your use of our website, products, and services. By accessing or using our services, you agree to be bound by these Terms.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Important Notice:</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Please read these Terms carefully before using our services</li>
                        <li>• By using our services, you agree to these Terms</li>
                        <li>• We may update these Terms from time to time</li>
                        <li>• Continued use constitutes acceptance of updated Terms</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Acceptance Section */}
              {activeSection === 'acceptance' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <CheckCircle className="w-5 h-5" />
                      <span>Acceptance of Terms</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Agreement to Terms</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        By accessing and using our website, products, or services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Eligibility</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• You must be at least 18 years old</li>
                          <li>• You must have legal capacity to enter contracts</li>
                          <li>• You must provide accurate information</li>
                          <li>• You must comply with all applicable laws</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Account Responsibility</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• You are responsible for your account security</li>
                          <li>• You must notify us of unauthorized access</li>
                          <li>• You are liable for all account activities</li>
                          <li>• You must keep information current</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Changes to Terms</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or website notice. Continued use after changes constitutes acceptance.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* User Accounts Section */}
              {activeSection === 'user-accounts' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <User className="w-5 h-5" />
                      <span>User Accounts</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Account Creation</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        To access certain features of our services, you may need to create an account. You agree to provide accurate, current, and complete information during registration.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Account Security</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Keep your password secure and confidential</li>
                          <li>• Notify us immediately of any security breach</li>
                          <li>• Use strong, unique passwords</li>
                          <li>• Enable two-factor authentication when available</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Account Termination</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• You may terminate your account at any time</li>
                          <li>• We may suspend or terminate accounts for violations</li>
                          <li>• Termination does not affect accrued obligations</li>
                          <li>• Some data may be retained for legal compliance</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Prohibited Account Activities</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Creating multiple accounts to circumvent restrictions</li>
                        <li>• Sharing account credentials with others</li>
                        <li>• Using automated tools to access our services</li>
                        <li>• Impersonating other users or entities</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Products & Services Section */}
              {activeSection === 'products-services' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Products & Services</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Product Information</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We strive to provide accurate product descriptions, specifications, and pricing. However, we reserve the right to correct errors and update information without notice.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Pricing & Availability</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Prices are subject to change without notice</li>
                          <li>• Product availability may vary</li>
                          <li>• We reserve the right to limit quantities</li>
                          <li>• Promotional offers have specific terms</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Order Processing</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Orders are subject to acceptance</li>
                          <li>• We may cancel orders for various reasons</li>
                          <li>• Processing times may vary</li>
                          <li>• International orders may have restrictions</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Services</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Electronics Supply</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            We provide electronic components and supplies for various applications, including prototyping and production.
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Prototyping Services</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Our prototyping services help bring your ideas to life with professional guidance and support.
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>PCB Printing</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            We offer PCB design and printing services for your electronic projects and prototypes.
                          </p>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>AI Consultancy</h5>
                          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            Our AI consultancy services help integrate artificial intelligence into your projects and workflows.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payments Section */}
              {activeSection === 'payments' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <CreditCard className="w-5 h-5" />
                      <span>Payments</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Payment Methods</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We accept various payment methods including credit cards, debit cards, bank transfers, and mobile money services.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Payment Processing</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Payments are processed securely</li>
                          <li>• We use industry-standard encryption</li>
                          <li>• Payment information is not stored locally</li>
                          <li>• Third-party processors handle transactions</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Billing & Invoicing</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Invoices are generated automatically</li>
                          <li>• Payment receipts are provided</li>
                          <li>• Billing disputes must be reported promptly</li>
                          <li>• Late payment fees may apply</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Accepted Payment Methods</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div className="text-center">
                          <div className="w-12 h-8 bg-blue-600 rounded text-white flex items-center justify-center mx-auto mb-1">
                            <span className="text-xs font-bold">VISA</span>
                          </div>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Visa</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-8 bg-red-600 rounded text-white flex items-center justify-center mx-auto mb-1">
                            <span className="text-xs font-bold">MC</span>
                          </div>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Mastercard</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-8 bg-green-600 rounded text-white flex items-center justify-center mx-auto mb-1">
                            <span className="text-xs font-bold">M-P</span>
                          </div>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>M-Pesa</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-8 bg-orange-600 rounded text-white flex items-center justify-center mx-auto mb-1">
                            <span className="text-xs font-bold">AIRTEL</span>
                          </div>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Airtel Money</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shipping & Returns Section */}
              {activeSection === 'shipping-returns' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Truck className="w-5 h-5" />
                      <span>Shipping & Returns</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Shipping Policy</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        We ship worldwide with various shipping options available. Shipping costs and delivery times vary by location and shipping method selected.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Shipping Options</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Standard shipping (5-7 business days)</li>
                          <li>• Express shipping (2-3 business days)</li>
                          <li>• Overnight shipping (1 business day)</li>
                          <li>• International shipping available</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Shipping Costs</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Calculated based on weight and destination</li>
                          <li>• Free shipping on orders over $100</li>
                          <li>• International shipping fees apply</li>
                          <li>• Express shipping has additional costs</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Returns & Refunds</h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Return Policy</h5>
                          <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                            <li>• 30-day return window from delivery date</li>
                            <li>• Items must be in original condition</li>
                            <li>• Original packaging required</li>
                            <li>• Return shipping costs may apply</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className={cn("font-medium text-sm mb-2", themeClasses.mainText)}>Refund Process</h5>
                          <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                            <li>• Refunds processed within 5-10 business days</li>
                            <li>• Original payment method refunded</li>
                            <li>• Processing fees may be deducted</li>
                            <li>• International returns may have restrictions</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Non-Returnable Items</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Custom-made or personalized products</li>
                        <li>• Digital products and software</li>
                        <li>• Perishable goods</li>
                        <li>• Items damaged by misuse</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Intellectual Property Section */}
              {activeSection === 'intellectual-property' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Scale className="w-5 h-5" />
                      <span>Intellectual Property</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Our Intellectual Property</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        All content, trademarks, logos, and intellectual property on our website and services are owned by {companyName || 'Honic Co.'} or our licensors.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Protected Content</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Website design and layout</li>
                          <li>• Product descriptions and images</li>
                          <li>• Software and applications</li>
                          <li>• Trademarks and logos</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>User Content</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• You retain ownership of your content</li>
                          <li>• You grant us license to use your content</li>
                          <li>• You represent you have necessary rights</li>
                          <li>• We may remove content that violates terms</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Prohibited Uses</h4>
                      <ul className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                        <li>• Copying or reproducing our content without permission</li>
                        <li>• Using our trademarks without authorization</li>
                        <li>• Reverse engineering our software</li>
                        <li>• Creating derivative works without consent</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Prohibited Uses Section */}
              {activeSection === 'prohibited-uses' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <AlertTriangle className="w-5 h-5" />
                      <span>Prohibited Uses</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>General Prohibitions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        You may not use our services for any unlawful purpose or in any way that could damage, disable, overburden, or impair our services.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Illegal Activities</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Violating any applicable laws or regulations</li>
                          <li>• Infringing on intellectual property rights</li>
                          <li>• Engaging in fraudulent activities</li>
                          <li>• Money laundering or tax evasion</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Harmful Activities</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Transmitting viruses or malicious code</li>
                          <li>• Attempting unauthorized access</li>
                          <li>• Interfering with service operations</li>
                          <li>• Harassing other users</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Commercial Restrictions</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Reselling our services without permission</li>
                          <li>• Using automated tools to access services</li>
                          <li>• Scraping or harvesting data</li>
                          <li>• Competing unfairly with our business</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Content Restrictions</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Posting offensive or inappropriate content</li>
                          <li>• Sharing false or misleading information</li>
                          <li>• Violating others' privacy rights</li>
                          <li>• Promoting illegal or harmful activities</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Consequences of Violations</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        Violations of these prohibited uses may result in immediate account suspension, termination of services, and legal action where appropriate.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disclaimers Section */}
              {activeSection === 'disclaimers' && (
                <Card className={cn(themeClasses.backgroundColor, themeClasses.borderColor)}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center space-x-2", themeClasses.mainText)}>
                      <Shield className="w-5 h-5" />
                      <span>Disclaimers & Limitations</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Service Disclaimers</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Our services are provided "as is" without warranties of any kind. We disclaim all warranties, express or implied, including but not limited to merchantability and fitness for a particular purpose.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Limitation of Liability</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• We are not liable for indirect damages</li>
                          <li>• Liability is limited to service fees paid</li>
                          <li>• No liability for third-party actions</li>
                          <li>• Force majeure events excluded</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Service Availability</h4>
                        <ul className={cn("text-sm space-y-2", themeClasses.textNeutralSecondary)}>
                          <li>• Services may be temporarily unavailable</li>
                          <li>• Maintenance windows may occur</li>
                          <li>• No guarantee of uninterrupted service</li>
                          <li>• Technical issues may arise</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Third-Party Services</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        Our services may integrate with third-party services. We are not responsible for the availability, content, or practices of these third-party services.
                      </p>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Important Notice</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        These disclaimers and limitations are subject to applicable law. Some jurisdictions may not allow certain limitations, so they may not apply to you.
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
                      <h4 className={cn("font-semibold text-sm mb-3", themeClasses.mainText)}>Legal Questions</h4>
                      <p className={cn("text-sm mb-4", themeClasses.textNeutralSecondary)}>
                        If you have any questions about these Terms of Service or need legal assistance, please contact us:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Mail className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>Email</p>
                            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                              {adminSettings?.contactEmail || 'legal@honic.co'}
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
                              Within 48 hours
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className={cn("font-semibold text-sm mb-2", themeClasses.mainText)}>Legal Department</h4>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        For formal legal notices, disputes, or compliance matters, please address correspondence to our Legal Department.
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
