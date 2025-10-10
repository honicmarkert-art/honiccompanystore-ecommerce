/**
 * Image Recognition Service
 * 
 * Uses Google Cloud Vision API for intelligent product search from images
 * Falls back to filename-based search if API is not configured
 */

import { logger } from './logger'

export interface ImageAnalysisResult {
  labels: string[]           // General labels (e.g., "electronics", "cable")
  objects: string[]          // Detected objects (e.g., "USB cable", "laptop")
  text: string[]            // Text detected in image (e.g., "DHT22", "Arduino")
  colors: string[]          // Dominant colors
  webEntities: string[]     // Similar products/entities from web
  confidence: number        // Overall confidence score (0-1)
}

/**
 * Analyze image using Google Cloud Vision API
 * Requires GOOGLE_CLOUD_VISION_API_KEY environment variable
 */
export async function analyzeImage(imageBuffer: Buffer): Promise<ImageAnalysisResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  
  if (!apiKey) {
    logger.log('Google Cloud Vision API key not configured, using fallback')
    return {
      labels: [],
      objects: [],
      text: [],
      colors: [],
      webEntities: [],
      confidence: 0
    }
  }

  try {
    // Convert image to base64
    const base64Image = imageBuffer.toString('base64')
    
    // Call Google Cloud Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 10 },
                { type: 'IMAGE_PROPERTIES', maxResults: 5 },
                { type: 'WEB_DETECTION', maxResults: 10 }
              ]
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`)
    }

    const data = await response.json()
    const result = data.responses[0]

    // Extract labels
    const labels = result.labelAnnotations?.map((label: any) => 
      label.description.toLowerCase()
    ) || []

    // Extract detected objects
    const objects = result.localizedObjectAnnotations?.map((obj: any) => 
      obj.name.toLowerCase()
    ) || []

    // Extract text from image
    const text = result.textAnnotations?.[0]?.description
      .split(/\s+/)
      .filter((word: string) => word.length > 2)
      .map((word: string) => word.toLowerCase()) || []

    // Extract dominant colors
    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.slice(0, 3)
      .map((color: any) => {
        const r = Math.round(color.color.red || 0)
        const g = Math.round(color.color.green || 0)
        const b = Math.round(color.color.blue || 0)
        return `rgb(${r},${g},${b})`
      }) || []

    // Extract web entities (similar products)
    const webEntities = result.webDetection?.webEntities
      ?.filter((entity: any) => entity.score > 0.5)
      .map((entity: any) => entity.description.toLowerCase()) || []

    // Calculate confidence score
    const avgLabelScore = result.labelAnnotations?.reduce(
      (sum: number, label: any) => sum + label.score, 0
    ) / (result.labelAnnotations?.length || 1)
    
    const confidence = avgLabelScore || 0

    logger.log('Image analysis complete:', {
      labelsCount: labels.length,
      objectsCount: objects.length,
      textCount: text.length,
      confidence
    })

    return {
      labels,
      objects,
      text,
      colors,
      webEntities,
      confidence
    }

  } catch (error) {
    console.error('Image analysis error:', error)
    return {
      labels: [],
      objects: [],
      text: [],
      colors: [],
      webEntities: [],
      confidence: 0
    }
  }
}

/**
 * Extract search keywords from image analysis
 * Prioritizes: text > objects > web entities > labels
 */
export function extractSearchKeywords(analysis: ImageAnalysisResult, filename: string): string[] {
  const keywords = new Set<string>()
  
  // Priority 1: Text detected in image (e.g., "DHT22", "Arduino")
  analysis.text.forEach(word => {
    if (word.length > 2) keywords.add(word)
  })
  
  // Priority 2: Detected objects (e.g., "USB cable")
  analysis.objects.forEach(obj => {
    keywords.add(obj)
    obj.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word)
    })
  })
  
  // Priority 3: Web entities (similar products)
  analysis.webEntities.forEach(entity => {
    keywords.add(entity)
    entity.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word)
    })
  })
  
  // Priority 4: Labels (general categories)
  analysis.labels.slice(0, 5).forEach(label => {
    keywords.add(label)
  })
  
  // Fallback: Extract from filename
  if (keywords.size === 0) {
    const filenameKeywords = filename
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
    
    filenameKeywords.forEach(word => keywords.add(word))
  }
  
  return Array.from(keywords).slice(0, 10) // Limit to top 10 keywords
}

/**
 * Alternative: Client-side image recognition using TensorFlow.js
 * (Optional - for offline mode or when API quota is exceeded)
 */
export async function analyzeImageClientSide(imageUrl: string): Promise<string[]> {
  // This would use TensorFlow.js MobileNet model
  // Not implemented yet, but can be added for offline support
  logger.log('Client-side image analysis not implemented yet')
  return []
}

/**
 * Fallback: Extract keywords from filename only
 */
export function extractKeywordsFromFilename(filename: string): string[] {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 5)
}


