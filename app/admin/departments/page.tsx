'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MapPin, Phone, Pencil, Building2 } from 'lucide-react'

interface Department {
  id: string
  name: string
  description: string
  location: string
  phone: string
}

interface DepartmentsData {
  departments: Department[]
  visitingHours: {
    general: { weekdays: string; weekends: string }
    icu: { allowed: string; maxVisitors: number; notes: string }
  }
}

export default function DepartmentsPage() {
  const [data, setData] = useState<DepartmentsData | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [formData, setFormData] = useState({
    description: '',
    location: '',
    phone: ''
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments')
    const result = await res.json()
    setData(result)
  }

  const openEdit = (dept: Department) => {
    setSelectedDept(dept)
    setFormData({
      description: dept.description,
      location: dept.location,
      phone: dept.phone
    })
    setIsEditOpen(true)
  }

  const handleEdit = async () => {
    if (!selectedDept) return
    await fetch('/api/departments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedDept.id, ...formData })
    })
    setIsEditOpen(false)
    setSelectedDept(null)
    fetchDepartments()
  }

  if (!data) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Departments</h1>
        <p className="text-muted-foreground">Manage hospital departments and visiting hours</p>
      </div>

      {/* Visiting Hours */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General Visiting Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekdays</span>
              <span className="font-medium">{data.visitingHours.general.weekdays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekends</span>
              <span className="font-medium">{data.visitingHours.general.weekends}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ICU Visiting Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowed</span>
              <span className="font-medium">{data.visitingHours.icu.allowed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Visitors</span>
              <span className="font-medium">{data.visitingHours.icu.maxVisitors}</span>
            </div>
            <p className="text-sm text-muted-foreground pt-2">{data.visitingHours.icu.notes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Departments Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.departments.map((dept) => (
          <Card key={dept.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{dept.name}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{dept.description}</p>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{dept.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{dept.phone}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedDept?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <Button onClick={handleEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
