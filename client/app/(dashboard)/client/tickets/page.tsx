"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import api from "@/lib/api"
import { toast } from "sonner"
import { MessageSquarePlus, TicketIcon, Send, User, ChevronRight } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

export default function ClientTicketsPage() {
  const { user: currentUser } = useAuth()
  const [tickets, setTickets] = useState([])
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [orderId, setOrderId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Thread dialog
  const [threadOpen, setThreadOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [ticketMessages, setTicketMessages] = useState<any[]>([])
  const [replyMessage, setReplyMessage] = useState("")
  const [replyLoading, setReplyLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)

  const getTicketStatusLabel = (status: string) => {
    switch (status) {
      case "OPEN": return "مفتوحة"
      case "IN_PROGRESS": return "قيد المعالجة"
      case "RESOLVED": return "تم الحل"
      default: return status
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OPEN': return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-500">مفتوحة</Badge>
      case 'IN_PROGRESS': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">قيد المعالجة</Badge>
      case 'RESOLVED': return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-500">تم الحل</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  useEffect(() => {
    fetchTickets()
    fetchOrders()
  }, [])

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/tickets')
      setTickets(data.tickets || [])
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchOrders = async () => {
    try {
      const { data } = await api.get("/orders", { params: { limit: 50 } })
      setOrders(data.orders || [])
    } catch {}
  }

  const getErrorMessage = (error: any, fallback: string) => {
    const raw = error?.response?.data?.error
    if (typeof raw === "string") return raw
    if (Array.isArray(raw)) return raw[0]?.message || fallback
    return fallback
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject || !message) return
    setIsSubmitting(true)
    try {
      await api.post('/tickets', { subject, message, ...(orderId ? { orderId } : {}) })
      toast.success("تم إنشاء تذكرة الدعم بنجاح")
      setSubject("")
      setMessage("")
      setOrderId("")
      fetchTickets()
    } catch (e: any) {
      toast.error(getErrorMessage(e, "فشل إنشاء التذكرة"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openTicketThread = async (ticket: any) => {
    setSelectedTicket(ticket)
    setThreadOpen(true)
    setMessagesLoading(true)
    try {
      const { data } = await api.get(`/tickets/${ticket.id}`)
      setTicketMessages(data.ticket?.messages || [])
      setSelectedTicket(data.ticket)
    } catch {
      toast.error("فشل تحميل الرسائل")
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return
    setReplyLoading(true)
    try {
      await api.post(`/tickets/${selectedTicket.id}/messages`, { message: replyMessage })
      toast.success("تم إرسال الرد")
      setReplyMessage("")
      const { data } = await api.get(`/tickets/${selectedTicket.id}`)
      setTicketMessages(data.ticket?.messages || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || "فشل إرسال الرد")
    } finally {
      setReplyLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">تذاكر الدعم</h2>
        <p className="text-muted-foreground">تواصل مع الدعم للمساعدة في شحناتك.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="w-5 h-5"/> تذاكري
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">جاري التحميل...</div>
              ) : tickets.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <MessageSquarePlus className="w-12 h-12 text-muted-foreground opacity-20 mb-4"/>
                  <span className="text-muted-foreground">لا توجد تذاكر دعم.</span>
                </div>
              ) : (
                <div className="divide-y">
                  {tickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-center cursor-pointer group"
                      onClick={() => openTicketThread(ticket)}
                    >
                      <div>
                        <h4 className="font-medium">{ticket.subject}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-lg">فتح تذكرة جديدة</CardTitle>
              <CardDescription>عادةً نرد خلال ساعتين.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">العنوان</Label>
                  <Input 
                    id="subject" 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    placeholder="مثال: تلف في الشحنة" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderId">طلب مرتبط (اختياري)</Label>
                  <select
                    id="orderId"
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">بدون طلب مرتبط</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {(order.shipmentNumber || order.id.slice(0, 8))} - {order.destination}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">الرسالة</Label>
                  <Textarea 
                    id="message" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="يرجى وصف المشكلة بالتفصيل..." 
                    rows={5} 
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الإرسال..." : "إرسال التذكرة"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* Ticket Thread Dialog */}
      <Dialog open={threadOpen} onOpenChange={setThreadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedTicket?.subject}</span>
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </DialogTitle>
            <DialogDescription>
              #{selectedTicket?.id?.slice(0, 8)} • {selectedTicket && new Date(selectedTicket.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 border rounded-lg p-3 bg-muted/20">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground py-8">جاري تحميل الرسائل...</div>
            ) : ticketMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">لا توجد رسائل بعد.</div>
            ) : (
              ticketMessages.map((msg: any) => {
                const isMe = msg.senderId === currentUser?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${isMe ? 'bg-primary/10 border border-primary/20' : 'bg-card border'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{msg.sender?.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {msg.sender?.role === 'ADMIN' ? 'مشرف' : 'أنت'}
                        </Badge>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {selectedTicket?.status !== 'RESOLVED' ? (
            <div className="flex gap-2">
              <Textarea
                placeholder="اكتب رسالتك..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleReply} disabled={replyLoading || !replyMessage.trim()} className="self-end gap-1">
                <Send className="h-4 w-4" />
                {replyLoading ? "..." : "إرسال"}
              </Button>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              تم حل هذه التذكرة.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
