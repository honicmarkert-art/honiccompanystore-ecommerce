"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanyContext } from '@/components/company-provider'
import { logger } from '@/lib/logger'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Youtube,
  ArrowRight,
  Download,
  CheckCircle,
  Flag
} from 'lucide-react'

export function Footer() {
  const { 
    companyName, 
    companyColor, 
    companyTagline, 
    companyLogo,
    settings: adminSettings
  } = useCompanyContext()
  
  const [email, setEmail] = useState('')

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle newsletter subscription
    logger.log('Newsletter subscription:', email)
    setEmail('')
  }

  const footerLinks = {
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Our Story', href: '/story' },
      { name: 'Careers', href: '/careers' },
      { name: 'Press & Media', href: '/press' },
      { name: 'Contact Us', href: '/contact' }
    ],
    services: [
      { name: 'Electronics Supply', href: '/services/electronics' },
      { name: 'Prototyping Services', href: '/services/prototyping' },
      { name: 'PCB Printing', href: '/services/pcb' },
      { name: 'AI Consultancy', href: '/services/ai' },
      { name: 'Logistics Solutions', href: '/services/logistics' }
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Order Tracking', href: '/tracking' },
      { name: 'Returns & Refunds', href: '/returns' },
      { name: 'Shipping Info', href: '/shipping' },
      { name: 'Technical Support', href: '/support' }
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'GDPR Compliance', href: '/gdpr' },
      { name: 'Data Protection', href: '/data-protection' }
    ]
  }

  const socialLinks = [
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, href: '/social/facebook' },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: '/social/twitter' },
    { name: 'Instagram', icon: <Instagram className="w-5 h-5" />, href: '/social/instagram' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: '/social/linkedin' },
    { name: 'YouTube', icon: <Youtube className="w-5 h-5" />, href: '/social/youtube' }
  ]

  return (
    <footer className="bg-gray-950 text-gray-300">
      {/* Main Footer Content */}
      <div className="px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Mobile: Company + Services + Support Row */}
          <div className="md:hidden grid grid-cols-3 gap-2 col-span-1">
            {/* Company Links */}
            <div>
              <h3 className="text-xs font-semibold mb-2 text-white">Company</h3>
              <ul className="space-y-1">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services Links */}
            <div>
              <h3 className="text-xs font-semibold mb-2 text-white">Services</h3>
              <ul className="space-y-1">
                {footerLinks.services.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links - Mobile */}
            <div>
              <h3 className="text-xs font-semibold mb-2 text-white">Support</h3>
              <ul className="space-y-1">
                {footerLinks.support.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <span 
                className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                style={{ color: companyColor }}
              >
                {companyName || 'Honic Co.'}
              </span>
            </div>
            <p className="text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
              Empowering innovation through comprehensive electronics solutions, prototyping services, 
              and AI-driven guidance for students, developers, and businesses worldwide.
            </p>
            
            {/* Contact Info - from Admin Settings */}
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              {adminSettings?.contactEmail && (
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">{adminSettings.contactEmail}</span>
                </div>
              )}
              {adminSettings?.contactPhone && (
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">{adminSettings.contactPhone}</span>
                </div>
              )}
              {adminSettings?.address && (
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">{adminSettings.address}</span>
                </div>
              )}
            </div>

             {/* Accepted Payment Methods - Desktop Only */}
             <div className="hidden md:block mb-4 sm:mb-6">
               <h4 className="text-xs sm:text-sm font-semibold mb-2 text-white">Accepted Payments</h4>
               <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                 {/* Bank Cards */}
                 <div className="flex items-center gap-1 sm:gap-2">
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-blue-600 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">VISA</span>
                   </div>
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-red-600 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">MC</span>
                   </div>
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-gray-700 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">AMEX</span>
                   </div>
                 </div>
                 
                 {/* Mobile Money */}
                 <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-green-600 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">M-P</span>
                   </div>
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-purple-600 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">TIGO</span>
                   </div>
                   <div className="w-8 h-5 sm:w-10 sm:h-6 bg-orange-600 rounded text-white flex items-center justify-center">
                     <span className="text-[7px] sm:text-[9px] font-bold">AIRTEL</span>
                   </div>
                 </div>
               </div>
             </div>

             {/* Social Links */}
             <div className="flex space-x-2 sm:space-x-4">
               {socialLinks.map((social, index) => (
                 <a
                   key={index}
                   href={social.href}
                   className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                   aria-label={social.name}
                 >
                   {social.icon}
                 </a>
               ))}
             </div>
          </div>

          {/* Company Links - Desktop/Tablet Only */}
          <div className="hidden md:block">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Company</h3>
            <ul className="space-y-1 sm:space-y-2">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services Links - Desktop/Tablet Only */}
          <div className="hidden md:block">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Services</h3>
            <ul className="space-y-1 sm:space-y-2">
              {footerLinks.services.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links - Desktop/Tablet Only */}
          <div className="hidden md:block">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Support</h3>
            <ul className="space-y-1 sm:space-y-2">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Stay Updated</h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Subscribe to our newsletter for the latest updates, exclusive offers, and industry insights.
              </p>
            </div>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-400 text-xs sm:text-sm"
                required
              />
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm">
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Download App Section */}
        <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Get Our Mobile App</h3>
              <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                Download our mobile app for a better shopping experience on the go.
              </p>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-xs sm:text-sm">
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  App Store
                </Button>
                <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-xs sm:text-sm">
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Google Play
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                <span className="text-xs sm:text-sm">Secure Payment</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                <span className="text-xs sm:text-sm">24/7 Support</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                <span className="text-xs sm:text-sm">Free Shipping</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800">
        <div className="px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-3 sm:space-y-4 md:space-y-0">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm">
              <span>&copy; 2024 {companyName || 'Honic Co.'}. All rights reserved.</span>
              <div className="flex flex-wrap justify-center sm:justify-start space-x-2 sm:space-x-4">
                {footerLinks.legal.map((link, index) => (
                  <a key={index} href={link.href} className="hover:text-orange-400 transition-colors">
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
