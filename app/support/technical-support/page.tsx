"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Shield,
  Smartphone,
  Monitor,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  RefreshCw,
  Settings,
  HelpCircle,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Info,
  Bug,
  Database,
  Lock,
  Globe
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TechnicalIssue {
  id: string
  title: string
  description: string
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
}

interface TroubleshootingStep {
  step: number
  title: string
  description: string
  icon: React.ReactNode
  completed: boolean
}

export default function TechnicalSupportPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const categories = [
    { id: 'all', name: 'All Issues', icon: <HelpCircle className="w-5 h-5" />, count: 0 },
    { id: 'website', name: 'Website Issues', icon: <Monitor className="w-5 h-5" />, count: 8 },
    { id: 'mobile', name: 'Mobile App', icon: <Smartphone className="w-5 h-5" />, count: 5 },
    { id: 'account', name: 'Account & Login', icon: <Lock className="w-5 h-5" />, count: 6 },
    { id: 'payment', name: 'Payment Issues', icon: <Shield className="w-5 h-5" />, count: 4 },
    { id: 'performance', name: 'Performance', icon: <RefreshCw className="w-5 h-5" />, count: 3 }
  ]

  const troubleshootingSteps: TroubleshootingStep[] = [
    {
      step: 1,
      title: 'Check Your Internet Connection',
      description: 'Ensure you have a stable internet connection and try refreshing the page',
      icon: <Wifi className="w-6 h-6" />,
      completed: true
    },
    {
      step: 2,
      title: 'Clear Browser Cache',
      description: 'Clear your browser cache and cookies, then try accessing the site again',
      icon: <RefreshCw className="w-6 h-6" />,
      completed: true
    },
    {
      step: 3,
      title: 'Try a Different Browser',
      description: 'Test the issue in a different browser to see if it\'s browser-specific',
      icon: <Monitor className="w-6 h-6" />,
      completed: false
    },
    {
      step: 4,
      title: 'Disable Browser Extensions',
      description: 'Temporarily disable browser extensions that might interfere with the site',
      icon: <Settings className="w-6 h-6" />,
      completed: false
    },
    {
      step: 5,
      title: 'Check for Updates',
      description: 'Ensure your browser and operating system are up to date',
      icon: <Download className="w-6 h-6" />,
      completed: false
    },
    {
      step: 6,
      title: 'Contact Support',
      description: 'If the issue persists, contact our technical support team',
      icon: <Phone className="w-6 h-6" />,
      completed: false
    }
  ]

  const commonIssues = [
    {
      id: '1',
      title: 'Website not loading properly',
      description: 'Pages are slow to load or display incorrectly',
      category: 'website',
      severity: 'medium',
      status: 'open',
      createdAt: '2025-01-15',
      updatedAt: '2025-01-15'
    },
    {
      id: '2',
      title: 'Cannot log into account',
      description: 'Login form not working or showing error messages',
      category: 'account',
      severity: 'high',
      status: 'in-progress',
      createdAt: '2025-01-14',
      updatedAt: '2025-01-16'
    },
    {
      id: '3',
      title: 'Mobile app crashes on startup',
      description: 'App closes immediately after opening',
      category: 'mobile',
      severity: 'critical',
      status: 'resolved',
      createdAt: '2025-01-12',
      updatedAt: '2025-01-15'
    },
    {
      id: '4',
      title: 'Payment processing error',
      description: 'Cannot complete payment transactions',
      category: 'payment',
      severity: 'high',
      status: 'open',
      createdAt: '2025-01-13',
      updatedAt: '2025-01-13'
    },
    {
      id: '5',
      title: 'Search function not working',
      description: 'Product search returns no results or errors',
      category: 'website',
      severity: 'medium',
      status: 'resolved',
      createdAt: '2025-01-10',
      updatedAt: '2025-01-14'
    },
    {
      id: '6',
      title: 'Slow page loading times',
      description: 'Pages take too long to load completely',
      category: 'performance',
      severity: 'low',
      status: 'open',
      createdAt: '2025-01-11',
      updatedAt: '2025-01-11'
    }
  ]

  const filteredIssues = commonIssues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || issue.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'medium':
        return <Info className="w-4 h-4 text-yellow-500" />
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'open':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-TZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className={`min-h-screen ${themeClasses.mainBg} ${themeClasses.mainText}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Technical Support</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Get help with technical issues and platform problems
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Bug className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search for technical issues or problems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  // Search is already triggered by onChange
                }
              }}
              className="pl-12 pr-4 py-3 text-lg"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Call Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Speak directly with our tech team</p>
              <Button variant="outline" size="sm">
                +255 12 737 7461
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Send detailed issue description</p>
              <Button variant="outline" size="sm">
                tech@honiccompanystore.com
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-4">Chat with technical support</p>
              <Button variant="outline" size="sm">
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Issue Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-r-2 border-orange-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`${selectedCategory === category.id ? 'text-orange-500' : 'text-muted-foreground'}`}>
                          {category.icon}
                        </div>
                        <span className={`font-medium ${selectedCategory === category.id ? 'text-orange-700 dark:text-orange-300' : ''}`}>
                          {category.name}
                        </span>
                      </div>
                      {category.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {category.count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Troubleshooting Steps */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Quick Troubleshooting Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {troubleshootingSteps.map((step, index) => (
                    <div key={step.step} className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.completed 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {step.completed ? <CheckCircle className="w-5 h-5" /> : step.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Common Issues */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Common Technical Issues</h2>
              
              {filteredIssues.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bug className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No issues found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try searching with different keywords or browse by category
                    </p>
                    <Button onClick={() => setSearchTerm('')}>
                      Clear Search
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredIssues.map((issue) => (
                    <Card key={issue.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{issue.title}</h3>
                            <p className="text-muted-foreground mb-3">{issue.description}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Created: {formatDate(issue.createdAt)}</span>
                              <span>•</span>
                              <span>Updated: {formatDate(issue.updatedAt)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge className={getSeverityColor(issue.severity)}>
                              {getSeverityIcon(issue.severity)}
                              <span className="ml-2 capitalize">{issue.severity}</span>
                            </Badge>
                            <Badge className={getStatusColor(issue.status)}>
                              <span className="capitalize">{issue.status.replace('-', ' ')}</span>
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Info className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Report Similar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Support CTA */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Still need technical help?</h2>
              <p className="text-xl mb-8 opacity-90">
                Our technical support team is here to help you resolve any issues
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" className="bg-white text-orange-500 hover:bg-gray-100">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Support
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
