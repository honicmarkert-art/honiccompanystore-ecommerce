"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Package,
  Globe,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  Info,
  Shield,
  Zap,
  Car
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ShippingOption {
  id: string
  name: string
  description: string
  price: number
  deliveryTime: string
  coverage: string[]
  features: string[]
  icon: React.ReactNode
  color: string
}

interface DeliveryZone {
  zone: string
  cities: string[]
  standardDelivery: string
  expressDelivery: string
  freeShippingThreshold: number
}

export default function ShippingInfoPage() {
  const { themeClasses } = useTheme()
  const router = useRouter()
  const [selectedZone, setSelectedZone] = useState('dar-es-salaam')

  const shippingOptions: ShippingOption[] = [
    {
      id: 'standard',
      name: 'Standard Shipping',
      description: 'Reliable delivery to your doorstep',
      price: 5000,
      deliveryTime: '3-5 business days',
      coverage: ['Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Tanga'],
      features: ['Tracked delivery', 'Signature required', 'Insurance included'],
      icon: <Truck className="w-6 h-6" />,
      color: 'bg-blue-500'
    },
    {
      id: 'express',
      name: 'Express Shipping',
      description: 'Fast delivery for urgent orders',
      price: 10000,
      deliveryTime: '1-2 business days',
      coverage: ['Dar es Salaam', 'Arusha', 'Mwanza'],
      features: ['Priority handling', 'Same-day dispatch', 'Real-time tracking'],
      icon: <Zap className="w-6 h-6" />,
      color: 'bg-orange-500'
    },
    {
      id: 'pickup',
      name: 'Store Pickup',
      description: 'Pick up your order from our store',
      price: 0,
      deliveryTime: 'Same day',
      coverage: ['Dar es Salaam only'],
      features: ['No shipping cost', 'Immediate pickup', 'Personal assistance'],
      icon: <Car className="w-6 h-6" />,
      color: 'bg-green-500'
    },
    {
      id: 'international',
      name: 'International Shipping',
      description: 'Worldwide delivery to select countries',
      price: 25000,
      deliveryTime: '7-14 business days',
      coverage: ['Kenya', 'Uganda', 'Rwanda', 'Burundi'],
      features: ['Customs handling', 'International tracking', 'Duty paid'],
      icon: <Globe className="w-6 h-6" />,
      color: 'bg-purple-500'
    }
  ]

  const deliveryZones: DeliveryZone[] = [
    {
      zone: 'dar-es-salaam',
      cities: ['Dar es Salaam', 'Kinondoni', 'Ilala', 'Temeke', 'Ubungo'],
      standardDelivery: '1-2 business days',
      expressDelivery: 'Same day',
      freeShippingThreshold: 100000
    },
    {
      zone: 'major-cities',
      cities: ['Arusha', 'Mwanza', 'Dodoma', 'Tanga', 'Morogoro', 'Moshi'],
      standardDelivery: '2-3 business days',
      expressDelivery: '1-2 business days',
      freeShippingThreshold: 100000
    },
    {
      zone: 'other-regions',
      cities: ['Iringa', 'Mbeya', 'Tabora', 'Kigoma', 'Mtwara', 'Lindi'],
      standardDelivery: '3-5 business days',
      expressDelivery: '2-3 business days',
      freeShippingThreshold: 100000
    }
  ]

  const faqs = [
    {
      question: 'How much does shipping cost?',
      answer: 'Shipping costs vary by location and speed. Standard shipping costs TZS 5,000, Express shipping costs TZS 10,000, and Store pickup is free. We offer free shipping on orders over TZS 100,000 in Dar es Salaam.'
    },
    {
      question: 'How long does delivery take?',
      answer: 'Delivery times depend on your location and chosen shipping method. Standard delivery takes 1-2 days in Dar es Salaam, 2-3 days in major cities, and 3-5 days in other regions. Express delivery is available for faster shipping.'
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes, we ship to Kenya, Uganda, Rwanda, and Burundi. International shipping costs TZS 25,000 and takes 7-14 business days. We handle all customs documentation and duties.'
    },
    {
      question: 'Can I track my order?',
      answer: 'Yes, all orders come with tracking information. You\'ll receive a tracking number via email and SMS, and you can track your order status in your account.'
    },
    {
      question: 'What if I\'m not home for delivery?',
      answer: 'Our delivery partner will attempt delivery 3 times. If you\'re not available, they\'ll leave a delivery notice with instructions for pickup or rescheduling.'
    },
    {
      question: 'Is my package insured?',
      answer: 'Yes, all packages are insured against loss or damage during transit. If your package is lost or damaged, we\'ll provide a full refund or replacement.'
    }
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const selectedZoneData = deliveryZones.find(zone => zone.zone === selectedZone) || deliveryZones[0]

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
          <h1 className="text-4xl font-bold mb-4">Shipping Information</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Fast, reliable shipping options to get your orders delivered quickly and safely
          </p>
        </div>

        {/* Shipping Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {shippingOptions.map((option) => (
            <Card key={option.id} className="hover:shadow-lg transition-shadow group">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${option.color} rounded-lg flex items-center justify-center text-white`}>
                    {option.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{option.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {option.price === 0 ? 'Free' : formatCurrency(option.price)}
                    </div>
                    <div className="text-sm text-muted-foreground">{option.deliveryTime}</div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Coverage:</h4>
                    <div className="flex flex-wrap gap-1">
                      {option.coverage.slice(0, 2).map((city, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {city}
                        </Badge>
                      ))}
                      {option.coverage.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{option.coverage.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {option.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Delivery Zones */}
          <div className="lg:col-span-1">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Zones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deliveryZones.map((zone) => (
                    <div key={zone.zone} className="space-y-2">
                      <button
                        onClick={() => setSelectedZone(zone.zone)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedZone === zone.zone
                            ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <h3 className="font-semibold capitalize">
                          {zone.zone.replace('-', ' ')}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {zone.cities.slice(0, 3).join(', ')}
                          {zone.cities.length > 3 && ` +${zone.cities.length - 3} more`}
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Free Shipping Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Free Shipping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(selectedZoneData.freeShippingThreshold)}
                    </div>
                    <div className="text-sm text-muted-foreground">Minimum order for free shipping</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Standard Delivery:</span>
                      <span className="font-medium">{selectedZoneData.standardDelivery}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Express Delivery:</span>
                      <span className="font-medium">{selectedZoneData.expressDelivery}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Selected Zone Details */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>
                  Delivery Information for {selectedZoneData.zone.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Cities Covered</h4>
                    <div className="space-y-1">
                      {selectedZoneData.cities.map((city, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span>{city}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Delivery Times</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <span>Standard: {selectedZoneData.standardDelivery}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span>Express: {selectedZoneData.expressDelivery}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FAQ Section */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Shipping FAQ</h2>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support CTA */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Need help with shipping?</h2>
              <p className="text-xl mb-8 opacity-90">
                Our support team is here to help you with any shipping questions
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
