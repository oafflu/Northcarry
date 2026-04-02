/**
 * Generate tracking URL for different carriers
 */
export function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  if (!carrier || !trackingNumber) return null

  const normalizedCarrier = carrier.trim().toUpperCase()
  const normalizedTracking = trackingNumber.trim()

  // Check for exact matches first
  switch (normalizedCarrier) {
    case 'UPS':
      // Modern UPS tracking URL format
      return `https://www.ups.com/track?tracknum=${normalizedTracking}`
    
    case 'FEDEX':
    case 'FEDEX EXPRESS':
    case 'FEDEX GROUND':
      // Modern FedEx tracking URL format
      return `https://www.fedex.com/fedextrack/?trknbr=${normalizedTracking}`
    
    case 'USPS':
      // USPS tracking URL format (using tLabels parameter)
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${normalizedTracking}`
    
    case 'DHL':
      // DHL Express tracking URL format
      return `https://www.dhl.com/en/express/tracking.html?AWB=${normalizedTracking}`
    
    case '4PX':
    case '4XP':  // Support both 4PX and 4XP variations
      // 4PX tracking URL format - requires /0/ between /result and tracking number
      return `https://track.4px.com/#/result/0/${normalizedTracking}`
    
    default:
      // Check for partial matches (e.g., "4PX FAST" contains "4PX" or "4XP")
      if (normalizedCarrier.includes('4PX') || normalizedCarrier.includes('4XP')) {
        return `https://track.4px.com/#/result/0/${normalizedTracking}`
      }
      if (normalizedCarrier.includes('UPS')) {
        return `https://www.ups.com/track?tracknum=${normalizedTracking}`
      }
      if (normalizedCarrier.includes('FEDEX')) {
        return `https://www.fedex.com/fedextrack/?trknbr=${normalizedTracking}`
      }
      if (normalizedCarrier.includes('USPS')) {
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${normalizedTracking}`
      }
      if (normalizedCarrier.includes('DHL')) {
        return `https://www.dhl.com/en/express/tracking.html?AWB=${normalizedTracking}`
      }
      
      // For unknown carriers, return null
      return null
  }
}

/**
 * Get carrier display name
 */
export function getCarrierDisplayName(carrier: string): string {
  if (!carrier) return 'N/A'
  
  const normalizedCarrier = carrier.trim().toUpperCase()
  
  // Check for exact matches first
  switch (normalizedCarrier) {
    case 'UPS':
      return 'UPS'
    case 'FEDEX':
    case 'FEDEX EXPRESS':
    case 'FEDEX GROUND':
      return 'FedEx'
    case 'USPS':
      return 'USPS'
    case 'DHL':
      return 'DHL'
    case '4PX':
    case '4XP':
      return '4PX'
    default:
      // Check for partial matches
      if (normalizedCarrier.includes('4PX') || normalizedCarrier.includes('4XP')) {
        return '4PX'
      }
      if (normalizedCarrier.includes('UPS')) {
        return 'UPS'
      }
      if (normalizedCarrier.includes('FEDEX')) {
        return 'FedEx'
      }
      if (normalizedCarrier.includes('USPS')) {
        return 'USPS'
      }
      if (normalizedCarrier.includes('DHL')) {
        return 'DHL'
      }
      // Return original carrier name if no match
      return carrier
  }
}

/**
 * List of available carriers
 */
export const AVAILABLE_CARRIERS = [
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: '4PX', label: '4PX' },
] as const

