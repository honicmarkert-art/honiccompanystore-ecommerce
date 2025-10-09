"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  MessageCircle, 
  Send, 
  Search, 
  Filter,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  ShoppingBag,
  Package
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

interface Message {
  id: string
  subject: string
  content: string
  date: Date
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  category: 'order' | 'product' | 'payment' | 'shipping' | 'general'
  orderId?: string
  isUnread: boolean
  lastReply?: Date
  replies: Array<{
    id: string
    content: string
    date: Date
    isFromSupport: boolean
    agentName?: string
  }>
}

function MessagesPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([])
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)
  const [newMessageData, setNewMessageData] = useState({
    subject: '',
    content: '',
    category: 'general' as Message['category'],
    priority: 'medium' as Message['priority']
  })
  const [replyContent, setReplyContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if there's an order parameter for new message
    const orderParam = searchParams.get('order')
    if (orderParam) {
      setNewMessageData(prev => ({
        ...prev,
        subject: `Order ${orderParam} - Support Request`,
        category: 'order'
      }))
      setIsNewMessageOpen(true)
    }

    // Mock messages data
    const mockMessages: Message[] = [
      {
        id: '1',
        subject: 'Order ORD-2024-001 - Delivery Status',
        content: 'Hi, I would like to know the current status of my order ORD-2024-001. It was supposed to be delivered yesterday but I haven\'t received any updates.',
        date: new Date('2024-01-15'),
        status: 'resolved',
        priority: 'medium',
        category: 'order',
        orderId: 'ORD-2024-001',
        isUnread: false,
        lastReply: new Date('2024-01-16'),
        replies: [
          {
            id: '1',
            content: 'Thank you for contacting us. I can see that your order has been shipped and is currently in transit. The estimated delivery date is tomorrow.',
            date: new Date('2024-01-16'),
            isFromSupport: true,
            agentName: 'Sarah M.'
          }
        ]
      },
      {
        id: '2',
        subject: 'Product Quality Issue - Arduino Uno',
        content: 'I received my Arduino Uno but it seems to have some quality issues. The board has some scratches and the USB port feels loose.',
        date: new Date('2024-01-12'),
        status: 'in-progress',
        priority: 'high',
        category: 'product',
        isUnread: true,
        lastReply: new Date('2024-01-14'),
        replies: [
          {
            id: '2',
            content: 'I apologize for the inconvenience. We take product quality very seriously. Please send us photos of the damage and we will arrange a replacement.',
            date: new Date('2024-01-14'),
            isFromSupport: true,
            agentName: 'Mike R.'
          }
        ]
      },
      {
        id: '3',
        subject: 'Payment Method Question',
        content: 'I want to know if you accept mobile money payments from Tanzania. I prefer using M-Pesa or TigoPesa for my purchases.',
        date: new Date('2024-01-10'),
        status: 'resolved',
        priority: 'low',
        category: 'payment',
        isUnread: false,
        lastReply: new Date('2024-01-11'),
        replies: [
          {
            id: '3',
            content: 'Yes, we do accept mobile money payments including M-Pesa, TigoPesa, and other major providers in Tanzania. You can select this option during checkout.',
            date: new Date('2024-01-11'),
            isFromSupport: true,
            agentName: 'Lisa K.'
          }
        ]
      },
      {
        id: '4',
        subject: 'Shipping to Zanzibar',
        content: 'Do you ship to Zanzibar? I\'m planning to place an order but want to confirm shipping availability and costs.',
        date: new Date('2024-01-08'),
        status: 'open',
        priority: 'medium',
        category: 'shipping',
        isUnread: false,
        replies: []
      },
      {
        id: '5',
        subject: 'Account Verification Issue',
        content: 'I\'m having trouble verifying my email address. The verification link doesn\'t seem to work properly.',
        date: new Date('2024-01-05'),
        status: 'closed',
        priority: 'medium',
        category: 'general',
        isUnread: false,
        lastReply: new Date('2024-01-06'),
        replies: [
          {
            id: '4',
            content: 'I\'ve manually verified your account. You should now be able to access all features. If you continue to have issues, please let us know.',
            date: new Date('2024-01-06'),
            isFromSupport: true,
            agentName: 'David L.'
          }
        ]
      }
    ]

    setMessages(mockMessages)
    setFilteredMessages(mockMessages)
    setIsLoading(false)
  }, [searchParams])

  // Filter messages based on search and filters
  useEffect(() => {
    let filtered = messages

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(message =>
        message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        message.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(message => message.status === statusFilter)
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(message => message.category === categoryFilter)
    }

    setFilteredMessages(filtered)
  }, [searchTerm, statusFilter, categoryFilter, messages])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800">Open</Badge>
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800">Resolved</Badge>
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-800">Closed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
      case 'low':
        return <Badge className="bg-green-100 text-green-800">Low</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'order':
        return <ShoppingBag className="w-4 h-4" />
      case 'product':
        return <Package className="w-4 h-4" />
      case 'payment':
        return <MessageCircle className="w-4 h-4" />
      case 'shipping':
        return <Package className="w-4 h-4" />
      default:
        return <MessageCircle className="w-4 h-4" />
    }
  }

  const handleNewMessage = () => {
    setIsNewMessageOpen(true)
  }

  const handleSendMessage = () => {
    if (!newMessageData.subject || !newMessageData.content) return

    const newMessage: Message = {
      id: Date.now().toString(),
      subject: newMessageData.subject,
      content: newMessageData.content,
      date: new Date(),
      status: 'open',
      priority: newMessageData.priority,
      category: newMessageData.category,
      isUnread: false,
      replies: []
    }

    setMessages(prev => [newMessage, ...prev])
    setNewMessageData({
      subject: '',
      content: '',
      category: 'general',
      priority: 'medium'
    })
    setIsNewMessageOpen(false)
  }

  const handleSendReply = () => {
    if (!selectedMessage || !replyContent.trim()) return

    const newReply = {
      id: Date.now().toString(),
      content: replyContent,
      date: new Date(),
      isFromSupport: false
    }

    setMessages(prev => prev.map(msg => 
      msg.id === selectedMessage.id 
        ? { ...msg, replies: [...msg.replies, newReply], lastReply: new Date() }
        : msg
    ))

    setSelectedMessage(prev => prev ? { ...prev, replies: [...prev.replies, newReply], lastReply: new Date() } : null)
    setReplyContent('')
  }

  const handleViewMessage = (message: Message) => {
    setSelectedMessage(message)
    // Mark as read
    setMessages(prev => prev.map(msg => 
      msg.id === message.id ? { ...msg, isUnread: false } : msg
    ))
  }

  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    return user?.email?.split('@')[0] || 'User'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Message Center</h1>
            <p className="text-muted-foreground">Get help and support for your orders</p>
          </div>
          <Button onClick={handleNewMessage}>
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="space-y-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="all">All Categories</option>
                    <option value="order">Order</option>
                    <option value="product">Product</option>
                    <option value="payment">Payment</option>
                    <option value="shipping">Shipping</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              {/* Messages List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      selectedMessage?.id === message.id ? 'bg-blue-50 border-blue-200' : ''
                    } ${message.isUnread ? 'bg-yellow-50 border-yellow-200' : ''}`}
                    onClick={() => handleViewMessage(message)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(message.category)}
                        <h4 className="font-medium text-sm truncate">{message.subject}</h4>
                      </div>
                      {message.isUnread && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {message.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {message.date.toLocaleDateString()}
                      </span>
                      <div className="flex space-x-1">
                        {getStatusBadge(message.status)}
                        {getPriorityBadge(message.priority)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedMessage.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedMessage.date.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {getStatusBadge(selectedMessage.status)}
                    {getPriorityBadge(selectedMessage.priority)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Original Message */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">{getUserName().charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{getUserName()}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedMessage.date.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{selectedMessage.content}</p>
                  </div>

                  {/* Replies */}
                  {selectedMessage.replies.map((reply) => (
                    <div key={reply.id} className={`p-4 rounded-lg ${
                      reply.isFromSupport ? 'bg-blue-50' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-2 mb-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {reply.isFromSupport ? 'S' : getUserName().charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {reply.isFromSupport ? `Support Agent ${reply.agentName}` : getUserName()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {reply.date.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{reply.content}</p>
                    </div>
                  ))}

                  {/* Reply Form */}
                  {selectedMessage.status !== 'closed' && (
                    <div className="border-t pt-4">
                      <Textarea
                        placeholder="Type your reply..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="mb-2"
                        rows={3}
                      />
                      <Button onClick={handleSendReply} disabled={!replyContent.trim()}>
                        <Send className="w-4 h-4 mr-2" />
                        Send Reply
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a message</h3>
                <p className="text-muted-foreground">
                  Choose a message from the list to view its details and replies.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      {isNewMessageOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>New Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={newMessageData.subject}
                  onChange={(e) => setNewMessageData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter subject..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={newMessageData.category}
                  onChange={(e) => setNewMessageData(prev => ({ ...prev, category: e.target.value as Message['category'] }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="general">General</option>
                  <option value="order">Order</option>
                  <option value="product">Product</option>
                  <option value="payment">Payment</option>
                  <option value="shipping">Shipping</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={newMessageData.priority}
                  onChange={(e) => setNewMessageData(prev => ({ ...prev, priority: e.target.value as Message['priority'] }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={newMessageData.content}
                  onChange={(e) => setNewMessageData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Describe your issue or question..."
                  rows={5}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsNewMessageOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendMessage} disabled={!newMessageData.subject || !newMessageData.content}>
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <MessagesPageContent />
    </ProtectedRoute>
  )
} 
 