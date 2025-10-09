"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { LazyImage } from "@/components/lazy-image"
import { logger } from '@/lib/logger'
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ServiceCardProps {
  service: {
    icon: React.ReactNode
    title: string
    description: string
    images: string[]
    color: string
    onClick: () => void
  }
  rotationTime: number
}

function isVideoFile(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '/video/']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

export function ServiceCardWithRotation({ service, rotationTime }: ServiceCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Image rotation effect
  useEffect(() => {
    if (!service.images || service.images.length <= 1) return

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % service.images.length)
    }, rotationTime * 1000)

    return () => clearInterval(interval)
  }, [service.images, rotationTime])

  const hasImages = service.images && service.images.length > 0

  return (
    <Card 
      className="bg-gray-700 border-gray-600 hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 cursor-pointer overflow-hidden" 
      onClick={service.onClick}
    >
      {/* Image Section */}
      <div className="relative h-24 sm:h-32 lg:h-40 overflow-hidden">
        {hasImages ? (
          <>
            {service.images.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "absolute inset-0 transition-opacity duration-1000",
                  index === currentImageIndex ? "opacity-100" : "opacity-0"
                )}
              >
                {isVideoFile(image) ? (
                  <video
                    src={image}
                    className="object-cover w-full h-full"
                    muted
                    loop
                    playsInline
                    autoPlay
                    onError={(e) => {
                      logger.log('Video failed to load:', image)
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <LazyImage
                    src={image}
                    alt={service.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover"
                    priority={index === 0} // Priority for first image
                    quality={80}
                    onError={() => {
                      logger.log('Image failed to load:', image)
                    }}
                  />
                )}
              </div>
            ))}
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white drop-shadow-lg">
              {service.icon}
            </div>
          </div>
        )}
        
        {/* Icon overlay */}
        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
          <div className="w-4 h-4 sm:w-6 sm:h-6 text-white drop-shadow-lg">
            {service.icon}
          </div>
        </div>

        {/* Image indicator dots */}
        {hasImages && service.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 z-20">
            {service.images.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  index === currentImageIndex 
                    ? "bg-white w-4" 
                    : "bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <CardContent className="p-2 sm:p-3 lg:p-4 text-center">
        <h3 className="text-xs sm:text-sm lg:text-base font-bold text-white uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
          {service.title}
        </h3>
        <p className="text-gray-300 text-xs sm:text-sm leading-tight sm:leading-relaxed">
          {service.description}
        </p>
      </CardContent>
    </Card>
  )
}


