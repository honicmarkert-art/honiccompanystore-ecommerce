"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { 
  Users, 
  Search, 
  Mail, 
  Shield, 
  Clock,
  CheckCircle,
  XCircle,
  User,
  Building2,
  Filter,
  LayoutGrid,
  List,
  Eye,
  Power,
  PowerOff,
  MoreVertical,
  Phone,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SecurityGuard } from '@/components/security-guard'
import { supabaseClient } from '@/lib/supabase-client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { formatDistanceToNow } from 'date-fns'

interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  is_admin: boolean
  is_supplier: boolean
  is_active: boolean | null
  company_name: string | null
  created_at: string
  updated_at: string
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
}

export default function AdminUsersPage() {
  return (
    <SecurityGuard requireAuth={true} requireAdmin={true}>
      <AdminUsersContent />
    </SecurityGuard>
  )
}

function AdminUsersContent() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supplier' | 'user'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Fetch users from API
  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users || [])
      setFilteredUsers(data.users || [])
    } catch (e) {
      setUsers([])
      setFilteredUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Real-time subscription for user status changes
  useEffect(() => {
    let isMounted = true
    let channel: RealtimeChannel | null = null

    const setupRealtime = async () => {
      if (!isMounted) return

      try {
        if (channel) {
          try {
            supabaseClient.removeChannel(channel)
          } catch (error) {
            }
        }

        channel = supabaseClient
          .channel('admin-users-status-realtime', {
            config: {
              broadcast: { self: true },
            }
          })
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles'
            },
            (payload) => {
              if (!isMounted) return
              
              const updatedProfile = payload.new as any
              const oldProfile = payload.old as any
              
              // Update if is_active, is_admin, or is_supplier changed
              if (
                updatedProfile.is_active !== oldProfile.is_active ||
                updatedProfile.is_admin !== oldProfile.is_admin ||
                updatedProfile.is_supplier !== oldProfile.is_supplier
              ) {
                setUsers(prev => 
                  prev.map(user => 
                    user.id === updatedProfile.id
                      ? { ...user, ...updatedProfile }
                      : user
                  )
                )
                setFilteredUsers(prev => 
                  prev.map(user => 
                    user.id === updatedProfile.id
                      ? { ...user, ...updatedProfile }
                      : user
                  )
                )
                if (selectedUser && selectedUser.id === updatedProfile.id) {
                  setSelectedUser(prev => prev ? { ...prev, ...updatedProfile } : null)
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              }
          })

      } catch (error) {
        }
    }

    setupRealtime()

    return () => {
      isMounted = false
      if (channel) {
        try {
          supabaseClient.removeChannel(channel)
        } catch (error) {
          }
      }
    }
  }, [selectedUser])

  // Filter users
  useEffect(() => {
    let filtered = users

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => user.is_active !== false)
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(user => user.is_active === false)
    }

    // Role filter
    if (roleFilter === 'admin') {
      filtered = filtered.filter(user => user.is_admin === true)
    } else if (roleFilter === 'supplier') {
      filtered = filtered.filter(user => user.is_supplier === true)
    } else if (roleFilter === 'user') {
      filtered = filtered.filter(user => !user.is_admin && !user.is_supplier)
    }

    setFilteredUsers(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [users, searchTerm, statusFilter, roleFilter])

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Handle activate/deactivate
  const handleToggleStatus = async (user: UserProfile) => {
    setIsActionLoading(true)
    const newStatus = user.is_active !== false ? false : true
    
    // Optimistically update UI
    setUsers(prev => 
      prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u)
    )
    setFilteredUsers(prev => 
      prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u)
    )

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        // Revert on error
        setUsers(prev => 
          prev.map(u => u.id === user.id ? { ...u, is_active: user.is_active } : u)
        )
        setFilteredUsers(prev => 
          prev.map(u => u.id === user.id ? { ...u, is_active: user.is_active } : u)
        )
        throw new Error(data.error || 'Failed to update user status')
      }
      
      toast({
        title: 'Success',
        description: `User ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      })
      
      await fetchUsers()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  // Get user role badge
  const getUserRoleBadge = (user: UserProfile) => {
    if (user.is_admin) {
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center gap-1">
        <Shield className="w-3 h-3" />
        Admin
      </Badge>
    }
    if (user.is_supplier) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        Supplier
      </Badge>
    }
    return <Badge variant="secondary" className="flex items-center gap-1">
      <User className="w-3 h-3" />
      User
    </Badge>
  }

  // Stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active !== false).length,
    inactive: users.filter(u => u.is_active === false).length,
    admins: users.filter(u => u.is_admin).length,
    suppliers: users.filter(u => u.is_supplier).length,
    regular: users.filter(u => !u.is_admin && !u.is_supplier).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold flex items-center gap-2", themeClasses.mainText)}>
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
            Manage and monitor user accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className={cn(themeClasses.buttonGhostHoverBg)}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold" style={{ color: 'inherit' }}>{stats.total}</div>
            <p className={cn("text-xs text-muted-foreground")}>Total Users</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <p className={cn("text-xs text-muted-foreground")}>Active</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.inactive}</div>
            <p className={cn("text-xs text-muted-foreground")}>Inactive</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.admins}</div>
            <p className={cn("text-xs text-muted-foreground")}>Admins</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.suppliers}</div>
            <p className={cn("text-xs text-muted-foreground")}>Suppliers</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold" style={{ color: 'inherit' }}>{stats.regular}</div>
            <p className={cn("text-xs text-muted-foreground")}>Regular Users</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn(themeClasses.buttonGhostHoverBg)}>
                    <Filter className="w-4 h-4 mr-2" />
                    Status: {statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'Inactive'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('active')}>Active</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>Inactive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn(themeClasses.buttonGhostHoverBg)}>
                    <Filter className="w-4 h-4 mr-2" />
                    Role: {roleFilter === 'all' ? 'All' : roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setRoleFilter('all')}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter('admin')}>Admin</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter('supplier')}>Supplier</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter('user')}>User</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List/Grid */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle>
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
              <p className={cn("text-sm mt-4", themeClasses.textNeutralSecondary)}>Loading users...</p>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className={cn("h-12 w-12 mx-auto mb-4", themeClasses.textNeutralSecondary)} />
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No users found</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedUsers.map((user) => (
                <Card
                  key={user.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    user.is_active === false && "opacity-60"
                  )}
                  onClick={() => {
                    setSelectedUser(user)
                    setIsDialogOpen(true)
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold truncate">{user.email}</span>
                        </div>
                        {user.full_name && (
                          <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>
                            {user.full_name}
                          </p>
                        )}
                        {user.company_name && (
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            {user.company_name}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedUser(user)
                              setIsDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleStatus(user)
                            }}
                            disabled={isActionLoading}
                          >
                            {user.is_active !== false ? (
                              <>
                                <PowerOff className="w-4 h-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="w-4 h-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getUserRoleBadge(user)}
                        {user.is_active !== false ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </Badge>
                        )}
                        {user.email_confirmed_at && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    {user.last_sign_in_at && (
                      <div className={cn("text-xs mt-3 flex items-center gap-1", themeClasses.textNeutralSecondary)}>
                        <Clock className="w-3 h-3" />
                        Last login: {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer",
                    themeClasses.cardBorder,
                    user.is_active === false && "opacity-60",
                    "hover:bg-opacity-50"
                  )}
                  onClick={() => {
                    setSelectedUser(user)
                    setIsDialogOpen(true)
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{user.email}</span>
                        {getUserRoleBadge(user)}
                        {user.is_active !== false ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {user.full_name && <span>{user.full_name}</span>}
                        {user.company_name && <span>{user.company_name}</span>}
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedUser(user)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(user)
                        }}
                        disabled={isActionLoading}
                      >
                        {user.is_active !== false ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={cn(themeClasses.buttonGhostHoverBg)}
                >
                  Previous
                </Button>
                <span className={cn("text-sm px-4", themeClasses.textNeutralSecondary)}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(themeClasses.buttonGhostHoverBg)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn("max-w-2xl", themeClasses.cardBg, themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View and manage user account information
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Email</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>{selectedUser.email}</p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Full Name</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {selectedUser.full_name || 'Not provided'}
                  </p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Phone</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {selectedUser.phone || 'Not provided'}
                  </p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Company</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {selectedUser.company_name || 'Not provided'}
                  </p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Status</Label>
                  <div className="mt-1">
                    {selectedUser.is_active !== false ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Role</Label>
                  <div className="mt-1">
                    {getUserRoleBadge(selectedUser)}
                  </div>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Email Verified</Label>
                  <div className="mt-1">
                    {selectedUser.email_confirmed_at ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Last Login</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {selectedUser.last_sign_in_at
                      ? formatDistanceToNow(new Date(selectedUser.last_sign_in_at), { addSuffix: true })
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Created</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className={cn(themeClasses.textNeutralSecondary)}>Updated</Label>
                  <p className={cn("font-medium", themeClasses.mainText)}>
                    {new Date(selectedUser.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className={cn(themeClasses.buttonGhostHoverBg)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handleToggleStatus(selectedUser)
                    setIsDialogOpen(false)
                  }}
                  disabled={isActionLoading}
                  variant={selectedUser.is_active !== false ? "destructive" : "default"}
                >
                  {selectedUser.is_active !== false ? (
                    <>
                      <PowerOff className="w-4 h-4 mr-2" />
                      Deactivate User
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 mr-2" />
                      Activate User
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
