/**
 * Search Synonym Map for E-commerce
 * 
 * Maps common search terms to their synonyms and variations
 * Improves search results by expanding user queries
 */

export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Power-related
  'adapter': ['charger', 'power supply', 'psu', 'power adapter', 'ac adapter', 'dc adapter'],
  'charger': ['adapter', 'power supply', 'charging cable', 'power cord'],
  'power supply': ['psu', 'adapter', 'charger', 'power brick'],
  'psu': ['power supply', 'adapter', 'power unit'],
  
  // Cable-related
  'cable': ['cord', 'wire', 'lead'],
  'cord': ['cable', 'wire', 'lead'],
  'usb': ['usb cable', 'usb cord', 'charging cable'],
  'hdmi': ['hdmi cable', 'hdmi cord', 'video cable'],
  'aux': ['audio cable', '3.5mm cable', 'headphone cable'],
  
  // Phone-related
  'phone': ['smartphone', 'mobile', 'cell phone', 'mobile phone'],
  'smartphone': ['phone', 'mobile', 'cell phone'],
  'mobile': ['phone', 'smartphone', 'cell phone'],
  'iphone': ['apple phone', 'ios phone'],
  'android': ['android phone', 'samsung', 'google phone'],
  
  // Computer-related
  'laptop': ['notebook', 'portable computer', 'laptop computer'],
  'notebook': ['laptop', 'portable computer'],
  'pc': ['computer', 'desktop', 'personal computer'],
  'computer': ['pc', 'desktop', 'laptop'],
  'desktop': ['pc', 'computer', 'tower'],
  'monitor': ['screen', 'display', 'lcd', 'led display'],
  'keyboard': ['keypad', 'keys'],
  'mouse': ['mice', 'pointer', 'trackball'],
  
  // Storage-related
  'hard drive': ['hdd', 'hard disk', 'storage drive'],
  'hdd': ['hard drive', 'hard disk'],
  'ssd': ['solid state drive', 'solid state disk', 'flash drive'],
  'usb drive': ['flash drive', 'thumb drive', 'usb stick', 'pen drive'],
  'flash drive': ['usb drive', 'thumb drive', 'pen drive'],
  'memory': ['ram', 'storage', 'memory card'],
  'ram': ['memory', 'system memory'],
  'sd card': ['memory card', 'flash card', 'sd'],
  
  // Audio-related
  'headphones': ['earphones', 'headset', 'earbuds', 'earpiece'],
  'earphones': ['headphones', 'earbuds', 'earpiece'],
  'earbuds': ['earphones', 'headphones', 'in-ear headphones'],
  'speaker': ['speakers', 'audio system', 'sound system'],
  'microphone': ['mic', 'microphone system'],
  'mic': ['microphone'],
  
  // Camera-related
  'camera': ['cam', 'webcam', 'digital camera'],
  'webcam': ['web camera', 'camera', 'video camera'],
  
  // Network-related
  'router': ['wifi router', 'wireless router', 'network router'],
  'wifi': ['wireless', 'wi-fi', 'wlan'],
  'wireless': ['wifi', 'wi-fi'],
  'ethernet': ['lan cable', 'network cable', 'cat5', 'cat6'],
  'modem': ['internet modem', 'broadband modem'],
  
  // Gaming-related
  'controller': ['gamepad', 'game controller', 'joystick'],
  'gamepad': ['controller', 'game controller'],
  'console': ['gaming console', 'game console'],
  'playstation': ['ps', 'ps4', 'ps5', 'sony console'],
  'xbox': ['microsoft console', 'xbox one', 'xbox series'],
  
  // Electronics
  'tv': ['television', 'smart tv', 'led tv'],
  'television': ['tv', 'smart tv'],
  'remote': ['remote control', 'controller'],
  'battery': ['batteries', 'cell', 'power cell'],
  'batteries': ['battery', 'cells', 'power cells'],
  
  // Accessories
  'case': ['cover', 'protective case', 'shell'],
  'cover': ['case', 'protective cover', 'skin'],
  'screen protector': ['tempered glass', 'glass protector', 'screen guard'],
  'stand': ['holder', 'mount', 'bracket'],
  'holder': ['stand', 'mount', 'cradle'],
  
  // Brands (common variations)
  'apple': ['iphone', 'ipad', 'macbook', 'mac'],
  'samsung': ['galaxy', 'samsung phone'],
  'sony': ['playstation', 'sony tv'],
  'microsoft': ['xbox', 'surface'],
  'google': ['pixel', 'google phone'],
  'huawei': ['honor'],
  
  // Common misspellings and variations
  'adaptor': ['adapter', 'charger'],
  'adapters': ['adapter', 'charger'],
  'chargeur': ['charger'],
  'labtop': ['laptop'],
  'mobil': ['mobile'],
  'fone': ['phone'],
}

/**
 * Expand search query with synonyms
 * 
 * @param query - Original search query
 * @returns Array of search terms including synonyms
 */
export function expandQueryWithSynonyms(query: string): string[] {
  const terms = new Set<string>()
  const normalizedQuery = query.toLowerCase().trim()
  
  // Add original query
  terms.add(normalizedQuery)
  
  // Split query into words
  const words = normalizedQuery.split(/\s+/)
  
  // Add each word
  words.forEach(word => terms.add(word))
  
  // Check for exact phrase matches in synonym map
  if (SEARCH_SYNONYMS[normalizedQuery]) {
    SEARCH_SYNONYMS[normalizedQuery].forEach(synonym => terms.add(synonym))
  }
  
  // Check for word matches
  words.forEach(word => {
    if (SEARCH_SYNONYMS[word]) {
      SEARCH_SYNONYMS[word].forEach(synonym => {
        terms.add(synonym)
        // Also add individual words from multi-word synonyms
        synonym.split(/\s+/).forEach(subWord => terms.add(subWord))
      })
    }
  })
  
  return Array.from(terms)
}

/**
 * Get all possible search variations for a query
 * Useful for building comprehensive search patterns
 */
export function getSearchVariations(query: string): {
  exact: string
  expanded: string[]
  fuzzyTerms: string[]
} {
  const exact = query.toLowerCase().trim()
  const expanded = expandQueryWithSynonyms(exact)
  
  // Generate fuzzy variations (common typos)
  const fuzzyTerms = new Set<string>(expanded)
  
  // Add variations with common letter substitutions
  expanded.forEach(term => {
    // Remove one character (typo: missing letter)
    for (let i = 0; i < term.length; i++) {
      fuzzyTerms.add(term.slice(0, i) + term.slice(i + 1))
    }
    
    // Swap adjacent characters (typo: transposition)
    for (let i = 0; i < term.length - 1; i++) {
      const swapped = term.slice(0, i) + term[i + 1] + term[i] + term.slice(i + 2)
      fuzzyTerms.add(swapped)
    }
  })
  
  return {
    exact,
    expanded,
    fuzzyTerms: Array.from(fuzzyTerms)
  }
}

/**
 * Example usage:
 * 
 * expandQueryWithSynonyms('laptop charger')
 * // Returns: ['laptop charger', 'laptop', 'charger', 'notebook', 'adapter', 'power supply', ...]
 * 
 * expandQueryWithSynonyms('usb cable')
 * // Returns: ['usb cable', 'usb', 'cable', 'usb cord', 'wire', 'lead', ...]
 */


