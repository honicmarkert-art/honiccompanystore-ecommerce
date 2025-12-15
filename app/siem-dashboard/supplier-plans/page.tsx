"use client"

import React, { useState, useEffect } from "react"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Crown,
  CheckCircle,
  XCircle,
  DollarSign,
  Package,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"

interface PlanFeature {
  id: string
  name: string
  description: string
  display_order: number
}

interface SupplierPlan {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  is_active: boolean
  max_products: number | null
  commission_rate: number | null
  display_order: number
  features: PlanFeature[]
  created_at: string
  updated_at: string
}

export default function SupplierPlansPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SupplierPlan | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<SupplierPlan | null>(null)
  const [plans, setPlans] = useState<SupplierPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    currency: 'TZS',
    is_active: true,
    max_products: null as number | null,
    commission_rate: null as number | null,
    display_order: 0
  })

  // Fetch plans from API
  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/supplier-plans', { 
        credentials: 'include',
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPlans(data.plans || [])
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch supplier plans",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast({
        title: "Error",
        description: "Failed to fetch supplier plans",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter plans based on search term
  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAdd = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: 0,
      currency: 'TZS',
      is_active: true,
      max_products: null,
      commission_rate: null,
      display_order: 0
    })
    setEditingPlan(null)
    setIsAddDialogOpen(true)
  }

  const handleEdit = (plan: SupplierPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency,
      is_active: plan.is_active,
      max_products: plan.max_products,
      commission_rate: plan.commission_rate,
      display_order: plan.display_order
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = (plan: SupplierPlan) => {
    setPlanToDelete(plan)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!planToDelete) return

    try {
      const response = await fetch(`/api/admin/supplier-plans/${planToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Plan deleted successfully"
        })
        fetchPlans()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to delete plan",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plan",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setPlanToDelete(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingPlan 
        ? `/api/admin/supplier-plans/${editingPlan.id}`
        : '/api/admin/supplier-plans'
      
      const method = editingPlan ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: editingPlan ? "Plan updated successfully" : "Plan created successfully"
        })
        setIsAddDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingPlan(null)
        fetchPlans()
        setFormData({
          name: '',
          slug: '',
          description: '',
          price: 0,
          currency: 'TZS',
          is_active: true,
          max_products: null,
          commission_rate: null,
          display_order: 0
        })
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to save plan",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save plan",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate slug from name
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className={cn("mt-4", themeClasses.textNeutralSecondary)}>Loading plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("container mx-auto p-6 space-y-6", themeClasses.background)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Supplier Plans</h1>
          <p className={cn("mt-1", themeClasses.textNeutralSecondary)}>
            Manage supplier subscription plans and pricing
          </p>
        </div>
        <Button onClick={handleAdd} className="bg-yellow-500 hover:bg-yellow-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Plan
        </Button>
      </div>

      {/* Search */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search plans by name, slug, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <Card key={plan.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className={cn("text-xl", themeClasses.mainText)}>
                    {plan.name}
                  </CardTitle>
                  <Badge 
                    variant={plan.is_active ? "default" : "secondary"}
                    className="mt-2"
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Crown className="w-6 h-6 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {plan.price === 0 ? 'Free' : `${plan.price.toLocaleString()} ${plan.currency}`}
                </p>
                {plan.description && (
                  <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                    {plan.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {plan.max_products !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className={themeClasses.textNeutralSecondary}>
                      Max Products: {plan.max_products === -1 ? 'Unlimited' : plan.max_products}
                    </span>
                  </div>
                )}
                {plan.commission_rate !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className={themeClasses.textNeutralSecondary}>
                      Commission: {plan.commission_rate}%
                    </span>
                  </div>
                )}
              </div>

              {plan.features && plan.features.length > 0 && (
                <div className="space-y-1">
                  <p className={cn("text-sm font-semibold", themeClasses.mainText)}>Features:</p>
                  <ul className="space-y-1">
                    {plan.features.slice(0, 3).map((feature) => (
                      <li key={feature.id} className={cn("text-xs flex items-start gap-1", themeClasses.textNeutralSecondary)}>
                        <CheckCircle className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{feature.name}</span>
                      </li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                        +{plan.features.length - 3} more features
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(plan)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(plan)}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="pt-6 text-center py-12">
            <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
              {searchTerm ? "No plans found matching your search" : "No supplier plans yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open)
        setIsEditDialogOpen(open)
        if (!open) {
          setEditingPlan(null)
          setFormData({
            name: '',
            slug: '',
            description: '',
            price: 0,
            currency: 'TZS',
            is_active: true,
            max_products: null,
            commission_rate: null,
            display_order: 0
          })
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Add New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Update the supplier plan details' : 'Create a new supplier subscription plan'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Premium Plan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g., premium-plan"
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Plan description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  placeholder="TZS"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_products">Max Products (-1 for unlimited)</Label>
                <Input
                  id="max_products"
                  type="number"
                  value={formData.max_products === null ? '' : formData.max_products}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    max_products: e.target.value === '' ? null : parseInt(e.target.value) 
                  }))}
                  placeholder="Leave empty for no limit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commission_rate === null ? '' : formData.commission_rate}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    commission_rate: e.target.value === '' ? null : parseFloat(e.target.value) 
                  }))}
                  placeholder="e.g., 5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked as boolean }))}
              />
              <Label htmlFor="is_active">Plan is active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false)
                  setIsEditDialogOpen(false)
                  setEditingPlan(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plan "{planToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

