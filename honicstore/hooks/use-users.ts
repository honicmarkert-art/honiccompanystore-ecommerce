"use client"

import { useState, useEffect } from "react"

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  lastLogin?: string
  status: string
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load users from API on mount
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to fetch users'
        setError(errorMessage)
        console.error('Failed to fetch users:', errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      setError(errorMessage)
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
      setIsInitialized(true)
    }
  }

  const addUser = async (user: Omit<User, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      if (response.ok) {
        const newUser = await response.json()
        setUsers(prev => [newUser, ...prev])
        return newUser
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to add user'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add user'
      setError(errorMessage)
      console.error('Error adding user:', error)
      throw error
    }
  }

  const updateUser = async (id: string, updates: Partial<User>) => {
    try {
      setError(null)
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(prev => 
          prev.map(user => 
            user.id === id ? updatedUser : user
          )
        )
        return updatedUser
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to update user'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user'
      setError(errorMessage)
      console.error('Error updating user:', error)
      throw error
    }
  }

  const deleteUser = async (id: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setUsers(prev => prev.filter(user => user.id !== id))
        return true
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to delete user'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user'
      setError(errorMessage)
      console.error('Error deleting user:', error)
      throw error
    }
  }

  const getUser = (id: string) => {
    return users.find(user => user.id === id)
  }

  const retry = () => {
    fetchUsers()
  }

  return {
    users,
    addUser,
    updateUser,
    deleteUser,
    getUser,
    retry,
    isInitialized,
    isLoading,
    error,
  }
} 