"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import api from "@/lib/api"
import { Search, MessageSquare, CheckCircle, Clock, Send, User } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"

export default function AdminTicketsPage() {
  const { user: currentUser } = useAuth()
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Reply dialog
  const [replyOpen, setReplyOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [ticketMessages, setTicketMessages] = useState<any[]>([])
  const [replyMessage, setReplyMessage] = useState("")
  const [replyLoading, setReplyLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)

  useEffect(() => { fetchTickets() }, [])

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/tickets')
      setTickets(data.tickets || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/tickets/${id}/status`, { status })
      toast.success("تم تحديث حالة التذكرة")
      fetchTickets()
      // Update current dialog if open
      if (selectedTicket?.id === id) {
        setSelectedTicket({ ...selectedTicket, status })
      }
    } catch(e) {
      toast.error("فشل تحديث الحالة")
    }
  }

  const openTicketThread = async (ticket: any) => {
    setSelectedTicket(ticket)
    setReplyOpen(true)
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
      // Refresh messages
      const { data } = await api.get(`/tickets/${selectedTicket.id}`)
      setTicketMessages(data.ticket?.messages || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || "فشل إرسال الرد")
    } finally {
      setReplyLoading(false)
    }
  }

  const filteredTickets = tickets.filter((t: any) =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.client?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OPEN': return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-500"><Clock className="w-3 h-3 mr-1"/> مفتوحة</Badge>
      case 'IN_PROGRESS': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">قيد المعالجة</Badge>
      case 'RESOLVED': return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-500"><CheckCircle className="w-3 h-3 mr-1"/> تم الحل</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">تذاكر الدعم</h2>
          <p className="text-muted-foreground">أدر استفسارات العملاء والشكاوى وطلبات الدعم.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>استفسارات العملاء</CardTitle>
            <CardDescription>جميع التذاكر ({filteredTickets.length})</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث بالعنوان أو العميل..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-4">تفاصيل التذكرة</th>
                  <th className="p-4">العميل</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">جاري تحميل التذاكر...</td></tr>
                ) : filteredTickets.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <MessageSquare className="w-10 h-10 opacity-20 mb-2" />
                      لا توجد تذاكر.
                    </div>
                  </td></tr>
                ) : (
                  filteredTickets.map((t: any) => (
                    <tr key={t.id} className="border-b transition-colors hover:bg-muted/40 last:border-0">
                      <td className="p-4 align-top">
                        <div className="font-medium text-[15px]">{t.subject}</div>
                        <div className="text-muted-foreground text-xs mt-1">#{t.id.slice(0,8)} • {new Date(t.createdAt).toLocaleDateString()}</div>
                        {t.messages && t.messages.length > 0 && (
                          <div className="text-muted-foreground text-xs mt-1">{t.messages.length} رسائل</div>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-medium">{t.client?.name || "غير معروف"}</div>
                        <div className="text-muted-foreground text-xs">{t.client?.email}</div>
                      </td>
                      <td className="p-4 align-top">{getStatusBadge(t.status)}</td>
                      <td className="p-4 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <select className="text-xs p-1 rounded border bg-transparent" value={t.status} onChange={(e) => updateTicketStatus(t.id, e.target.value)}>
                            <option value="OPEN">مفتوحة</option>
                            <option value="IN_PROGRESS">قيد المعالجة</option>
                            <option value="RESOLVED">تم الحل</option>
                          </select>
                          <Button variant="outline" size="sm" className="h-8 shadow-sm gap-1" onClick={() => openTicketThread(t)}>
                            <MessageSquare className="h-3.5 w-3.5" /> رد
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Thread + Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedTicket?.subject}</span>
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </DialogTitle>
            <DialogDescription>
              العميل: {selectedTicket?.client?.name} • #{selectedTicket?.id?.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 border rounded-lg p-3 bg-muted/20">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground py-8">جاري تحميل الرسائل...</div>
            ) : ticketMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">لا توجد رسائل بعد.</div>
            ) : (
              ticketMessages.map((msg: any) => {
                const isAdmin = msg.sender?.role === 'ADMIN'
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${isAdmin ? 'bg-primary/10 border border-primary/20' : 'bg-card border'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{msg.sender?.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {msg.sender?.role === 'ADMIN' ? 'مشرف' : 'عميل'}
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

          {/* Reply Input */}
          {selectedTicket?.status !== 'RESOLVED' && (
            <div className="flex gap-2">
              <Textarea
                placeholder="اكتب ردك هنا..."
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
          )}

          {selectedTicket?.status === 'RESOLVED' && (
            <div className="text-center text-sm text-muted-foreground bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              تم حل هذه التذكرة. لإعادة فتحها، غيّر الحالة من الجدول.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
