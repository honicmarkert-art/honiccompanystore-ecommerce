/**
 * Safely parse JSON response, handling cases where HTML is returned instead of JSON
 */

export async function safeJsonParse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  
  // Check if response is actually JSON
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    
    // If it's HTML (error page), throw a more helpful error
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint returned an error page.`)
    }
    
    // Try to parse as JSON anyway (some APIs don't set content-type correctly)
    try {
      return JSON.parse(text) as T
    } catch (parseError) {
      throw new Error(`Failed to parse response as JSON. Content-Type: ${contentType}, Status: ${response.status}, Response preview: ${text.substring(0, 200)}`)
    }
  }
  
  // Response is JSON, parse it
  try {
    return await response.json() as T
  } catch (parseError) {
    // If JSON parsing fails, try to get the text for better error message
    const text = await response.text().catch(() => 'Unable to read response text')
    throw new Error(`Failed to parse JSON response. Status: ${response.status}, Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}, Response preview: ${text.substring(0, 200)}`)
  }
}

/**
 * Fetch with safe JSON parsing
 */
export async function fetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    // Try to get error message from response
    try {
      const errorData = await safeJsonParse(response)
      throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Server returned HTML')) {
        throw error
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  }
  
  return safeJsonParse<T>(response)
}

