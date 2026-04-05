import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { calculateShippingBreakdownTrusted, normalizeLocationSegment } from '@/lib/shipping-calculator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cart/shipping-estimate
 * Server-side subtotal/shipping/total. Prices from DB only.
 * Shipping: zone base + distance from zone hub; delivery point from server geocode (structured address), not client GPS.
 */
export async function POST(request: NextRequest) {
  try {
    let body: {
      items?: Array<{ productId: number; variantId?: string | number | null; quantity: number }>
      deliveryOption?: string
      region?: string
      district?: string
      ward?: string
      country?: string
      city?: string
      streetName?: string
      address1?: string
      address2?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({
        subtotal: 0,
        shipping: 0,
        total: 0,
        currency: 'TZS',
      })
    }

    const supabase = getSupabaseClient()
    const productIds = [...new Set(items.map((i) => Number(i.productId)).filter((id) => id > 0))]
    const variantIds = items
      .map((i) => i.variantId)
      .filter((v) => v != null && v !== '' && String(v) !== 'default')
      .map((v) => parseInt(String(v), 10))
      .filter((n) => !isNaN(n) && n > 0)

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, free_delivery')
      .in('id', productIds)

    if (productsError || !products?.length) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    const productMap = new Map<number, any>()
    products.forEach((p: any) => productMap.set(p.id, p))

    let variantMap = new Map<number, any>()
    if (variantIds.length > 0) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, product_id, price, primary_values')
        .in('id', variantIds)
      if (variants?.length) {
        variants.forEach((v: any) => {
          if (v?.id != null) variantMap.set(v.id, v)
        })
      }
    }

    let subtotal = 0
    const validatedItems: { product_id: number; free_delivery: boolean }[] = []

    for (const it of items) {
      const productId = Number(it.productId)
      const quantity = Math.max(1, Math.min(1000, Math.floor(Number(it.quantity) || 1)))
      const product = productMap.get(productId)
      if (!product) continue

      let unitPrice = product.price != null ? Number(product.price) : NaN
      const variantId =
        it.variantId != null && it.variantId !== '' && String(it.variantId) !== 'default'
          ? parseInt(String(it.variantId), 10)
          : null
      if (variantId != null && !isNaN(variantId)) {
        const variant = variantMap.get(variantId)
        if (variant && (variant.product_id === productId || Number(variant.product_id) === productId)) {
          if (variant.price != null && variant.price !== '') {
            const p = Number(variant.price)
            if (!Number.isNaN(p) && p > 0) unitPrice = p
          }
          if ((Number.isNaN(unitPrice) || unitPrice <= 0) && variant.primary_values) {
            let pv = variant.primary_values
            if (typeof pv === 'string') {
              try {
                pv = JSON.parse(pv)
              } catch {
                pv = []
              }
            }
            if (Array.isArray(pv)) {
              for (const x of pv) {
                const p = x?.price != null && x?.price !== '' ? Number(x.price) : NaN
                if (!Number.isNaN(p) && p > 0) {
                  unitPrice = p
                  break
                }
              }
            }
          }
        }
      }

      if (Number.isNaN(unitPrice) || unitPrice <= 0) continue
      subtotal += unitPrice * quantity
      validatedItems.push({
        product_id: productId,
        free_delivery: product.free_delivery === true,
      })
    }

    const deliveryOption = body.deliveryOption === 'pickup' ? 'pickup' : 'shipping'
    const allFreeDelivery = validatedItems.length > 0 && validatedItems.every((i) => i.free_delivery)

    const breakdown = await calculateShippingBreakdownTrusted({
      deliveryOption,
      subtotal,
      allProductsFreeDelivery: allFreeDelivery,
      region: normalizeLocationSegment(body.region),
      district: normalizeLocationSegment(body.district),
      ward: normalizeLocationSegment(body.ward),
      addressForGeocode: {
        country: body.country,
        region: body.region,
        district: body.district,
        ward: body.ward,
        streetName: body.streetName,
        address1: body.address1,
        address2: body.address2,
        city: body.city,
      },
    })

    const shipping = breakdown.totalTz
    const total = subtotal + shipping

    return NextResponse.json({
      subtotal,
      shipping,
      shippingBase: breakdown.baseTz,
      shippingDistanceAddon: breakdown.distanceAddonTz,
      shippingGeocoded: breakdown.geocoded,
      shippingDistanceKm: breakdown.distanceKm,
      total,
      currency: 'TZS',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to compute estimate' }, { status: 500 })
  }
}
