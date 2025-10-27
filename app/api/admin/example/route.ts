import { NextRequest, NextResponse } from 'next/server'
import { withAdminRoute } from '@/lib/admin-middleware'

// Example admin-only API route using the enhanced middleware
export const GET = withAdminRoute(async (request: NextRequest, user: any) => {
  try {
    // This handler only runs for authenticated admin users
    console.log('🔐 Admin API accessed by:', user.user?.email)
    
    // Your admin-only logic here
    const adminData = {
      message: 'Welcome to admin API',
      user: {
        id: user.user?.id,
        email: user.user?.email,
        role: user.role
      },
      timestamp: new Date().toISOString(),
      permissions: ['read', 'write', 'delete', 'admin']
    }

    return NextResponse.json(adminData, { status: 200 })

  } catch (error) {
    console.error('❌ Admin API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const POST = withAdminRoute(async (request: NextRequest, user: any) => {
  try {
    const data = await request.json()
    
    console.log('🔐 Admin POST by:', user.user?.email, 'Data:', data)
    
    // Your admin-only POST logic here
    const result = {
      success: true,
      message: 'Admin action completed',
      user: user.user?.email,
      data: data,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    console.error('❌ Admin POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process admin request' },
      { status: 500 }
    )
  }
})

