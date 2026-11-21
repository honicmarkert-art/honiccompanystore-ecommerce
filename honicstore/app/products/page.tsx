"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Camera, Upload, CheckCircle, Shield, Zap, TrendingUp, Clock, ArrowRight, Heart, ShoppingCart, ChevronRight, Filter } from "lucide-react"

const CATEGORIES = [
  { name: "Electronics Components", count: 1234 },
  { name: "PCB & Circuitry", count: 856 },
  { name: "Prototyping Supplies", count: 432 },
  { name: "Tools & Equipment", count: 567 },
]

const PRODUCTS = [
  { id: 1, name: "Arduino Microcontroller", price: 450000, image: "🔧", stock: "In Stock", rating: 4.8 },
  { id: 2, name: "PCB Circuit Board", price: 650000, image: "📱", stock: "In Stock", rating: 4.6 },
  { id: 3, name: "Sensor Kit", price: 850000, image: "📡", stock: "In Stock", rating: 4.9 },
  { id: 4, name: "LED Strip Lights", price: 320000, image: "💡", stock: "In Stock", rating: 4.7 },
]

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <section className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-5xl font-bold mb-3 text-center">Get Ready for 2027</h1>
          <div className="bg-white rounded-full shadow-2xl p-2 flex items-center gap-2 mb-6 max-w-4xl mx-auto">
            <input type="text" placeholder="Search products..." className="flex-1 px-4 py-4 outline-none text-slate-900" />
            <Button className="bg-orange-500 hover:bg-orange-600 rounded-full px-8"><Search className="w-5 h-5" /></Button>
          </div>
        </div>
      </section>
      
      <section className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
        <div className="bg-white rounded-lg p-6 shadow-md"><CheckCircle className="w-10 h-10 text-orange-500 mb-4" /><h3 className="font-bold">Verified Supplier</h3></div>
        <div className="bg-white rounded-lg p-6 shadow-md"><Shield className="w-10 h-10 text-orange-500 mb-4" /><h3 className="font-bold">Order Protection</h3></div>
        <div className="bg-white rounded-lg p-6 shadow-md"><Zap className="w-10 h-10 text-orange-500 mb-4" /><h3 className="font-bold">Factory Pricing</h3></div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8 mb-20">
        <div className="hidden lg:block bg-white rounded-lg p-6 shadow-md h-fit sticky top-24">
          <h3 className="font-bold mb-4">Categories</h3>
          {CATEGORIES.map((cat, i) => <button key={i} className="block w-full text-left px-3 py-2 hover:bg-orange-100 rounded">{cat.name}</button>)}
        </div>

        <div className="lg:col-span-3">
          <h2 className="font-bold text-2xl mb-6">Featured Products</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {PRODUCTS.map(p => <Card key={p.id} className="hover:shadow-xl transition"><CardContent className="p-5"><div className="text-6xl mb-3">{p.image}</div><h4 className="font-semibold text-sm mb-2">{p.name}</h4><p className="font-bold text-orange-600">TSh {p.price.toLocaleString()}</p></CardContent></Card>)}
          </div>
        </div>
      </section>
    </div>
  )
}
