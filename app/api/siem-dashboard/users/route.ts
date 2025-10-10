import { NextRequest, NextResponse } from 'next/server'
import { users } from '@/lib/demo-users'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// GET - Fetch all users
export async function GET(request: NextRequest) {
  try {
    // In a real app, you'd fetch from database
    // For now, we'll use the demo users
    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        loginAttempts: user.loginAttempts,
        lockedUntil: user.lockedUntil,
        isActive: user.isActive || true // Default to active if not set
      }))
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, password } = body

    // Validate required fields
    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email.toLowerCase())
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Create new user
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase(),
      password: password, // In real app, hash this
      name: name,
      role: role as 'user' | 'admin',
      createdAt: new Date(),
      isVerified: true, // Admin created users are verified by default
      loginAttempts: 0,
      isActive: true
    }

    users.push(newUser)

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isVerified: newUser.isVerified,
        createdAt: newUser.createdAt,
        isActive: newUser.isActive
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, email, role, isActive, isVerified } = body

    // Find user
    const userIndex = users.findIndex(u => u.id === id)
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if email is already taken by another user
    if (email && email !== users[userIndex].email) {
      const existingUser = users.find(u => u.email === email.toLowerCase() && u.id !== id)
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already taken by another user' },
          { status: 409 }
        )
      }
    }

    // Update user
    users[userIndex] = {
      ...users[userIndex],
      name: name || users[userIndex].name,
      email: email ? email.toLowerCase() : users[userIndex].email,
      role: role || users[userIndex].role,
      isActive: isActive !== undefined ? isActive : users[userIndex].isActive,
      isVerified: isVerified !== undefined ? isVerified : users[userIndex].isVerified
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        name: users[userIndex].name,
        role: users[userIndex].role,
        isVerified: users[userIndex].isVerified,
        createdAt: users[userIndex].createdAt,
        lastLogin: users[userIndex].lastLogin,
        loginAttempts: users[userIndex].loginAttempts,
        lockedUntil: users[userIndex].lockedUntil,
        isActive: users[userIndex].isActive
      }
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find user
    const userIndex = users.findIndex(u => u.id === id)
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Remove user
    const deletedUser = users.splice(userIndex, 1)[0]

    return NextResponse.json({
      message: 'User deleted successfully',
      user: {
        id: deletedUser.id,
        email: deletedUser.email,
        name: deletedUser.name
      }
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
} 
 
 
 
 
 
 
 
 
