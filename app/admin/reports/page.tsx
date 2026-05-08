'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, FileText, Trash2, Send, Mail, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface LabReport {
  id: string
  patientName: string
  patientEmail: string
  patientPhone: string
  reportType: 'blood_test' | 'xray'
  testName: string
  fileUrl: string
  fileName: string
  notes?: string
  status: 'pending' | 'ready' | 'sent'
  createdAt: string
  sentAt?: string
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<LabReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  
  // Upload Form State
  const [formData, setFormData] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    reportType: 'blood_test',
    testName: '',
    notes: '',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/reports')
      const data = await res.json()
      if (data.reports) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('Please select a file to upload')
      return
    }

    setUploading(true)
    try {
      const data = new FormData()
      data.append('patientName', formData.patientName)
      data.append('patientEmail', formData.patientEmail)
      data.append('patientPhone', formData.patientPhone)
      data.append('reportType', formData.reportType)
      data.append('testName', formData.testName)
      data.append('notes', formData.notes)
      data.append('file', selectedFile)

      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        body: data,
      })

      if (res.ok) {
        setIsUploadModalOpen(false)
        setFormData({
          patientName: '',
          patientEmail: '',
          patientPhone: '',
          reportType: 'blood_test',
          testName: '',
          notes: '',
        })
        setSelectedFile(null)
        fetchReports()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to upload report')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload report')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this report? This will also remove the file from storage.')) return

    try {
      const res = await fetch(`/api/admin/reports?id=${id}&fileUrl=${encodeURIComponent(fileUrl)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchReports()
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete report')
    }
  }

  const handleSendEmail = async (id: string) => {
    setSendingId(id)
    try {
      const res = await fetch('/api/admin/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id })
      })

      if (res.ok) {
        fetchReports() // Refresh to show 'sent' status
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to send email')
      }
    } catch (error) {
      console.error('Send error:', error)
      alert('Failed to send email')
    } finally {
      setSendingId(null)
    }
  }

  const filteredReports = reports.filter(r => 
    r.patientName.toLowerCase().includes(search.toLowerCase()) ||
    r.patientEmail.toLowerCase().includes(search.toLowerCase()) ||
    r.testName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Reports</h1>
          <p className="text-muted-foreground">Manage and dispatch patient diagnostic reports</p>
        </div>
        <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Upload Report
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, email, or test..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={fetchReports}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Patient</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Test Details</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center">Loading reports...</td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted-foreground">
                    {search ? 'No reports found matching your search.' : 'No reports uploaded yet.'}
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <div className="font-medium">{report.patientName}</div>
                      <div className="text-xs text-muted-foreground">{report.patientEmail}</div>
                      <div className="text-xs text-muted-foreground">{report.patientPhone}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium">{report.testName}</div>
                      <Badge variant="outline" className="mt-1">
                        {report.reportType === 'blood_test' ? 'Blood Test' : 'X-Ray'}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 align-middle">
                      {report.status === 'sent' ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">Sent</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30">Pending Send</Badge>
                      )}
                      {report.sentAt && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(report.sentAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button 
                          variant={report.status === 'sent' ? "outline" : "default"} 
                          size="sm" 
                          onClick={() => handleSendEmail(report.id)}
                          disabled={sendingId === report.id}
                        >
                          {sendingId === report.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(report.id, report.fileUrl)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Lab Report</DialogTitle>
            <DialogDescription>
              Upload a diagnostic report to dispatch it to the patient.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientName">Patient Name</Label>
                <Input 
                  id="patientName" 
                  value={formData.patientName}
                  onChange={e => setFormData({...formData, patientName: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientEmail">Patient Email</Label>
                <Input 
                  id="patientEmail" 
                  type="email"
                  value={formData.patientEmail}
                  onChange={e => setFormData({...formData, patientEmail: e.target.value})}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patientPhone">Patient Phone (Optional)</Label>
              <Input 
                id="patientPhone" 
                value={formData.patientPhone}
                onChange={e => setFormData({...formData, patientPhone: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select 
                  value={formData.reportType} 
                  onValueChange={(v: 'blood_test'|'xray') => setFormData({...formData, reportType: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blood_test">Blood Test</SelectItem>
                    <SelectItem value="xray">X-Ray / Imaging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name</Label>
                <Input 
                  id="testName" 
                  placeholder="e.g., Complete Blood Count"
                  value={formData.testName}
                  onChange={e => setFormData({...formData, testName: e.target.value})}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Report File (PDF/Image)</Label>
              <Input 
                id="file" 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Doctor's Notes (Optional)</Label>
              <Input 
                id="notes" 
                placeholder="Any special instructions or observations..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : 'Upload Report'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
