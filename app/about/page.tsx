"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Target,
  Users,
  Award,
  Globe,
  Heart,
  Shield,
  Zap,
  Lightbulb,
  Truck,
  Clock,
  CheckCircle,
  Star,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  ArrowLeft
} from 'lucide-react'
import { useCompanyContext } from '@/components/company-provider'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AboutPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const { 
    companyName, 
    companyLogo,
    companyColor,
    companyTagline,
    isLoaded: companyLoaded
  } = useCompanyContext()

  // Fallback logo system
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo

  const stats = [
    { number: "10,000+", label: "Happy Customers", icon: <Users className="w-6 h-6" /> },
    { number: "50,000+", label: "Products Sold", icon: <Award className="w-6 h-6" /> },
    { number: "99.9%", label: "Uptime", icon: <Shield className="w-6 h-6" /> },
    { number: "24/7", label: "Customer Support", icon: <Clock className="w-6 h-6" /> }
  ]

  const values = [
    {
      icon: <Heart className="w-8 h-8" />,
      title: "Customer First",
      description: "We put our customers at the heart of everything we do, ensuring their satisfaction is our top priority."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Trust & Security",
      description: "Your data and transactions are protected with enterprise-grade security measures and privacy controls."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Innovation",
      description: "We continuously innovate to bring you the latest technology and cutting-edge solutions."
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Global Reach",
      description: "Serving customers worldwide with fast shipping and localized support in multiple languages."
    }
  ]


  const milestones = [
    {
      year: "2025",
      title: "Company Founded",
      description: "Started with a vision to revolutionize online shopping in Tanzania"
    },
    {
      year: "2025",
      title: "First 1000 Customers",
      description: "Reached our first major milestone with 1000 satisfied customers"
    },
    {
      year: "2025",
      title: "Mobile App Launch",
      description: "Launched our mobile application for iOS and Android"
    },
    {
      year: "2025",
      title: "Regional Expansion",
      description: "Expanded operations to cover all major cities in Tanzania"
    },
    {
      year: "2025",
      title: "AI Integration",
      description: "Integrated AI-powered features for better product recommendations"
    }
  ]

  return (
    <div className={`min-h-screen ${themeClasses.mainBg} ${themeClasses.mainText}`}>
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-8">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <Image
                  src={displayLogo}
                  alt={`${companyName} Logo`}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-2xl shadow-lg"
                />
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
                    About {companyName}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                    {companyTagline || "Your trusted partner in online shopping"}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 text-lg text-gray-700 dark:text-gray-300">
                <p>
                  Founded in 2025, {companyName} has quickly established itself as Tanzania's leading 
                  e-commerce platform, serving thousands of customers across the country.
                </p>
                <p>
                  We believe in making quality products accessible to everyone, with fast shipping, 
                  secure payments, and exceptional customer service that sets us apart.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
                  Shop Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Us
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat, index) => (
                  <Card key={index} className="text-center p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                    <div className="flex justify-center mb-3 text-orange-500">
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stat.number}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Our Story Section */}
      <div className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Our Story</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              What started as a simple idea to make quality products more accessible has quickly evolved into 
              a comprehensive e-commerce platform that serves customers across Tanzania. Our journey 
              in 2025 has been marked by rapid innovation, customer-centric approach, and a commitment 
              to excellence.
            </p>
          </div>

          {/* Timeline */}
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                      {milestone.year}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {milestone.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Our Values Section */}
      <div className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Our Values</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              These core values guide everything we do and shape our company culture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="text-center p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4 text-orange-500">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {value.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>


      {/* Why Choose Us Section */}
      <div className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Why Choose {companyName}?</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              We're committed to providing you with the best shopping experience possible
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Fast & Free Shipping
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get your orders delivered quickly with our reliable shipping partners across Tanzania
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Secure Payments
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your payment information is protected with bank-level security and encryption
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Customer Support
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Our dedicated support team is here to help you 24/7 with any questions or concerns
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Contact CTA Section */}
      <div className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Ready to Start Shopping?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Join thousands of satisfied customers and discover amazing products at great prices
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" className="bg-white text-orange-500 hover:bg-gray-100">
                  <Target className="w-4 h-4 mr-2" />
                  Browse Products
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Us
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-12 bg-gray-100 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Contact Info</h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  NSSF 3-Floor, Dar es Salaam, Tanzania
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" />
                  +255 12 737 7461
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  sales@honiccompanystore.com
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Follow Us</h3>
              <div className="flex justify-center gap-4">
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-orange-500">
                  <Facebook className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-orange-500">
                  <Twitter className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-orange-500">
                  <Instagram className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-orange-500">
                  <Linkedin className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Quick Links</h3>
              <div className="space-y-1 text-sm">
                <Link href="/products" className="block text-gray-600 dark:text-gray-300 hover:text-orange-500">
                  Products
                </Link>
                <Link href="/contact" className="block text-gray-600 dark:text-gray-300 hover:text-orange-500">
                  Contact Us
                </Link>
                <Link href="/account" className="block text-gray-600 dark:text-gray-300 hover:text-orange-500">
                  My Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
