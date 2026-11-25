/**
 * Delivery fees (TSh). One place to change every number; checkout, the order API and the
 * Delivery & shipping page all read from here.
 *
 * How it works (the usual model for Tanzanian online shops):
 *  - Dar es Salaam: bodaboda door delivery, priced by ward (unknown ward -> its district's fee).
 *  - Other regions: parcel sent by bus/courier to the customer's town, priced by zone
 *    (distance from Dar es Salaam). Zanzibar and Pemba go by ferry.
 *  - Size: fees cover a standard parcel. Medium items (e.g. 1 kg filament spools) and large items
 *    (3D printers, water purifiers) add a surcharge, because bus/courier companies charge by size.
 *  - Free delivery over the threshold (NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_TZS, default 100,000) covers the standard fee; the large-item
 *    surcharge still applies. Store pickup and products marked "free delivery" are free.
 */

export type ShippingSize = 'small' | 'medium' | 'large'

export type DeliveryZone = {
  id: string
  name: string
  /** fee for a standard (small) parcel */
  fee: number
  /** typical delivery time after payment is confirmed */
  eta: string
  regions: string[]
}

/** Zones outside Dar es Salaam, nearest first. Region names match lib/tanzania-address.ts (lower-cased). */
export const DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'near', name: 'Near Dar es Salaam', fee: 6000, eta: '2–3 days', regions: ['pwani', 'coast', 'morogoro', 'tanga', 'dodoma'] },
  { id: 'north-central', name: 'North & central', fee: 8000, eta: '2–4 days', regions: ['arusha', 'kilimanjaro', 'manyara', 'iringa', 'singida', 'njombe', 'lindi', 'mtwara'] },
  { id: 'lake-south', name: 'Lake zone & Southern Highlands', fee: 10000, eta: '3–5 days', regions: ['mwanza', 'mbeya', 'songwe', 'tabora', 'shinyanga', 'simiyu', 'geita', 'mara', 'ruvuma'] },
  { id: 'far-west', name: 'Far west', fee: 12000, eta: '4–6 days', regions: ['kagera', 'kigoma', 'katavi', 'rukwa'] },
  { id: 'zanzibar', name: 'Zanzibar (Unguja)', fee: 7000, eta: '2–4 days', regions: ['zanzibar central/south', 'zanzibar north', 'zanzibar urban/west'] },
  { id: 'pemba', name: 'Pemba', fee: 10000, eta: '3–5 days', regions: ['pemba north', 'pemba south'] },
]

/** Region not in any zone (shouldn't happen with the checkout list): priced like the farthest mainland zone */
export const UNKNOWN_REGION_ZONE: DeliveryZone = { id: 'other', name: 'Other regions', fee: 12000, eta: '4–6 days', regions: [] }

export const DAR_ES_SALAAM_ETA = '1–2 days'

/** Dar es Salaam: tier when the ward isn't listed, by district */
export const DAR_ES_SALAAM_DISTRICT_TIER: Record<string, 'A' | 'B' | 'C' | 'D'> = {
  ilala: 'B',
  kinondoni: 'C',
  ubungo: 'C',
  temeke: 'C',
  kigamboni: 'D',
}
/** Dar es Salaam with no district picked yet */
export const DAR_ES_SALAAM_FALLBACK_TIER = 'C' as const

/** Extra per order for bigger items (the biggest item in the order decides). */
export const SIZE_SURCHARGE: Record<ShippingSize, { dar: number; upcountry: number; label: string }> = {
  small: { dar: 0, upcountry: 0, label: 'Standard parcel' },
  medium: { dar: 0, upcountry: 2000, label: 'Medium item' },
  large: { dar: 5000, upcountry: 15000, label: 'Large item' },
}

/** Dar es Salaam: bodaboda door delivery in four tiers by distance from our store (city centre). */
export type DarTier = 'A' | 'B' | 'C' | 'D'
export const DAR_ES_SALAAM_TIERS: Record<DarTier, { name: string; fee: number }> = {
  A: { name: 'City centre', fee: 3000 },
  B: { name: 'Inner suburbs', fee: 4000 },
  C: { name: 'Outer suburbs', fee: 5000 },
  D: { name: 'Outskirts', fee: 7000 },
}

/** Ward -> tier (ward names lower-cased, as in lib/tanzania-address.ts). Unknown ward -> its district's tier. */
export const DAR_ES_SALAAM_WARD_TIER: Record<string, DarTier> = {
  // Ilala
  bonyokwa: 'B',
  buguruni: 'B',
  buyuni: 'C',
  chanika: 'C',
  gerezani: 'A',
  gongolamboto: 'C',
  ilala: 'B',
  jangwani: 'A',
  liwiti: 'A',
  kariakoo: 'A',
  kimanga: 'B',
  kinyerezi: 'C',
  kipawa: 'B',
  kipunguni: 'C',
  kisukuru: 'B',
  kitunda: 'C',
  kisutu: 'A',
  kivukoni: 'A',
  kivule: 'C',
  kiwalani: 'B',
  majohe: 'C',
  mchafukoge: 'A',
  mchikichini: 'B',
  'minazi mirefu': 'B',
  mnyamani: 'A',
  msongola: 'C',
  mzinga: 'C',
  pugu: 'C',
  'pugu station': 'C',
  segerea: 'B',
  tabata: 'B',
  ukonga: 'C',
  'upanga east': 'A',
  'upanga west': 'A',
  vingunguti: 'B',
  zingiziwa: 'C',
  // Kinondoni
  bunju: 'C',
  hananasif: 'A',
  kawe: 'B',
  kigogo: 'B',
  kijitonyama: 'B',
  kinondoni: 'B',
  kunduchi: 'C',
  mabwepande: 'D',
  magomeni: 'A',
  makongo: 'C',
  makumbusho: 'B',
  'mbezi juu': 'C',
  mbweni: 'C',
  mikocheni: 'B',
  msasani: 'B',
  mwananyamala: 'B',
  mzimuni: 'A',
  ndugumbi: 'A',
  tandale: 'B',
  wazo: 'C',
  // Temeke
  azimio: 'B',
  chamazi: 'C',
  charambe: 'B',
  keko: 'B',
  kibada: 'D',
  kimbiji: 'D',
  'kisarawe ii': 'D',
  kurasini: 'B',
  makangarawe: 'C',
  mbagala: 'C',
  'mbagala kuu': 'C',
  miburani: 'B',
  mjimwema: 'D',
  mtoni: 'B',
  'pemba mnazi': 'D',
  sandali: 'B',
  somangira: 'D',
  tandika: 'B',
  temeke: 'B',
  toangoma: 'C',
  vijibweni: 'D',
  'yombo vituka': 'C',
  // Ubungo
  goba: 'C',
  kibamba: 'C',
  kimara: 'C',
  kwembe: 'C',
  mabibo: 'B',
  makuburi: 'B',
  makurumla: 'B',
  manzese: 'B',
  mbezi: 'C',
  mburahati: 'B',
  msigani: 'B',
  saranga: 'C',
  sinza: 'B',
  ubungo: 'B',
  // Kigamboni
  tungi: 'D',
  kigamboni: 'C',
  somangila: 'D',
  pembamnazi: 'D',
}

/**
 * Tanzania geography: upcountry parcels go by bus/courier to the regional town (where the bus
 * terminal is). Districts away from that town need onward transport (local bus or bodaboda), so they
 * pay a little more. Islands reached by an extra ferry/boat pay more again.
 * District names lower-cased, as in lib/tanzania-address.ts.
 */
export const TOWN_DISTRICTS = new Set([
  // regional towns (bus terminals)
  'arusha city', 'ilemela', 'nyamagana', 'dodoma urban', 'mbeya city', 'tanga city', 'morogoro urban',
  'moshi urban', 'musoma urban', 'bukoba urban', 'iringa urban', 'tabora urban', 'kigoma urban',
  'mtwara urban', 'lindi urban', 'songea urban', 'shinyanga urban', 'singida urban', 'sumbawanga urban',
  'babati', 'njombe urban', 'geita', 'bariadi', 'mpanda urban', 'mbozi', 'kahama',
  // Pwani: daily direct buses from Dar es Salaam
  'kibaha', 'bagamoyo', 'kisarawe', 'mkuranga', 'kibiti', 'rufiji',
  // Zanzibar & Pemba towns
  'mjini', 'magharibi', 'chake chake', 'wete',
])

/** Outside the regional town (onward transport to the district) */
export const OUTSIDE_TOWN_SURCHARGE = 3000

/** Islands needing an extra boat/ferry from the mainland or main island (replaces the outside-town fee) */
export const ISLAND_DISTRICT_SURCHARGE: Record<string, number> = {
  mafia: 10000,
  ukerewe: 4000,
}
