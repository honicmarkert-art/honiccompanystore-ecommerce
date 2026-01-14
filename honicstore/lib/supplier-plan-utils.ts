/**
 * Utility functions for checking supplier plan features and limits
 */

interface SupplierPlan {
  id: string
  name: string
  slug: string
  max_products: number | null
  commission_rate: number | null
}

/**
 * Check if supplier can create more products based on their plan
 */
export async function canCreateProduct(
  userId: string,
  currentProductCount: number,
  plan: SupplierPlan | null
): Promise<{ allowed: boolean; reason?: string; maxProducts?: number }> {
  // If no plan, default to free plan restrictions
  if (!plan || plan.slug === 'free') {
    const maxProducts = plan?.max_products || 20
    if (currentProductCount >= maxProducts) {
      return {
        allowed: false,
        reason: `You have reached the limit of ${maxProducts} products for the Free Plan. Upgrade to Premium for unlimited products.`,
        maxProducts
      }
    }
    return { allowed: true, maxProducts }
  }

  // Premium plan has unlimited products (max_products is null)
  // Note: Payment verification happens in getSupplierPlan(), so if plan.slug === 'premium'
  // is true here, the user has already passed payment verification
  if (plan.slug === 'premium' || plan.max_products === null) {
    return { allowed: true }
  }

  // Winga plan has 10 product limit
  if (plan.slug === 'winga') {
    const maxProducts = plan.max_products || 10
    if (currentProductCount >= maxProducts) {
      return {
        allowed: false,
        reason: `You have reached the limit of ${maxProducts} products for the Winga Plan.`,
        maxProducts
      }
    }
    return { allowed: true, maxProducts }
  }

  // Other plans with specific limits
  if (plan.max_products && currentProductCount >= plan.max_products) {
    return {
      allowed: false,
      reason: `You have reached the limit of ${plan.max_products} products for the ${plan.name}.`,
      maxProducts: plan.max_products
    }
  }

  return { allowed: true, maxProducts: plan.max_products || null }
}

/**
 * Get supplier's current plan from database
 * SECURITY: For Premium plans, verifies payment status to ensure user has actually paid
 */
export async function getSupplierPlan(userId: string, supabase: any): Promise<SupplierPlan | null> {
  try {
    // Get supplier profile with plan and payment status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('supplier_plan_id, payment_status, payment_expires_at')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.supplier_plan_id) {
      // Default to free plan if no plan assigned
      const { data: freePlan } = await supabase
        .from('supplier_plans')
        .select('*')
        .eq('slug', 'free')
        .eq('is_active', true)
        .single()
      
      return freePlan || null
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('supplier_plans')
      .select('*')
      .eq('id', profile.supplier_plan_id)
      .single()

    if (planError || !plan) {
      // Fallback to free plan
      const { data: freePlan } = await supabase
        .from('supplier_plans')
        .select('*')
        .eq('slug', 'free')
        .eq('is_active', true)
        .single()
      
      return freePlan || null
    }

    // SECURITY CHECK: For Premium plans, verify payment status
    // Premium plans require valid payment to access features
    if (plan.slug === 'premium' || plan.price > 0) {
      const paymentStatus = profile.payment_status?.toLowerCase()
      const paymentExpiresAt = profile.payment_expires_at ? new Date(profile.payment_expires_at) : null
      const now = new Date()
      
      // Check if payment is valid
      const hasValidPayment = 
        paymentStatus === 'paid' || 
        paymentStatus === 'completed' ||
        (paymentExpiresAt && paymentExpiresAt > now)
      
      if (!hasValidPayment) {
        // Premium plan without valid payment - return free plan instead
        const { data: freePlan } = await supabase
          .from('supplier_plans')
          .select('*')
          .eq('slug', 'free')
          .eq('is_active', true)
          .single()
        
        return freePlan || null
      }
    }

    return plan
  } catch (error) {
    return null
  }
}

/**
 * Check if feature is available for the plan
 */
export function hasFeature(plan: SupplierPlan | null, featureName: string): boolean {
  if (!plan) return false

  // Premium plan has all features
  // Note: Payment verification happens in getSupplierPlan(), so if plan.slug === 'premium'
  // is true here, the user has already passed payment verification
  if (plan.slug === 'premium') {
    return true
  }

  // Free plan features
  if (plan.slug === 'free') {
    const freeFeatures = [
      'basic_analytics',
      'email_support',
      'product_listing',
      'order_management'
    ]
    return freeFeatures.includes(featureName.toLowerCase())
  }

  // Winga plan features (same as free plan)
  if (plan.slug === 'winga') {
    const wingaFeatures = [
      'basic_analytics',
      'email_support',
      'product_listing',
      'order_management'
    ]
    return wingaFeatures.includes(featureName.toLowerCase())
  }

  return false
}



