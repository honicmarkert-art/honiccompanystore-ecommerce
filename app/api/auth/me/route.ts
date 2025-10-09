import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { findUserById } from '@/lib/users'

export async function GET(request: NextRequest) {
  try {
    // Get token from request
    const token = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No authentication token provided',
          type: 'NO_TOKEN'
        },
        { status: 401 }
      )
    }

    // Verify token
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired token',
          type: 'INVALID_TOKEN'
        },
        { status: 401 }
      )
    }

    // Check if token has expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Token has expired',
          type: 'TOKEN_EXPIRED'
        },
        { status: 401 }
      )
    }

    // Find user
    const user = findUserById(decoded.userId)
    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User not found',
          type: 'USER_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User account is deactivated',
          type: 'USER_DEACTIVATED'
        },
        { status: 403 }
      )
    }

    // Return user data (without password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        profile: user.profile
      }
    })

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        type: 'SERVER_ERROR'
      },
      { status: 500 }
    )
  }
} 
 
 
 
 