'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react'

interface Doctor {
  id: string
  name: string
  specialty: string
  department: string
  departmentId: string
  consultationFee: number
  roomNumber: string
  availability: Record<string, string[]>
}

const DEPARTMENTS = [
  { id: 'dept-1', name: 'Orthopedics' },
  { id: 'dept-2', name: 'Cardiology' },
  { id: 'dept-3', name: 'Neurology' },
  { id: 'dept-4', name: 'Pediatrics' },
  { id: 'dept-5', name: 'Radiology' },
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
]

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    department: '',
    departmentId: '',
    consultationFee: 150,
    roomNumber: ''
  })

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    const res = await fetch('/api/doctors')
    const data = await res.json()
    setDoctors(data)
  }

  const handleAdd = async () => {
    const dept = DEPARTMENTS.find(d => d.name === formData.department)
    await fetch('/api/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        departmentId: dept?.id || ''
      })
    })
    setIsAddOpen(false)
    setFormData({ name: '', specialty: '', department: '', departmentId: '', consultationFee: 150, roomNumber: '' })
    fetchDoctors()
  }

  const handleEdit = async () => {
    if (!selectedDoctor) return
    const dept = DEPARTMENTS.find(d => d.name === formData.department)
    await fetch('/api/doctors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedDoctor.id,
        ...formData,
        departmentId: dept?.id || ''
      })
    })
    setIsEditOpen(false)
    setSelectedDoctor(null)
    fetchDoctors()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return
    await fetch(`/api/doctors?id=${id}`, { method: 'DELETE' })
    fetchDoctors()
  }

  const openEdit = (doctor: Doctor) => {
    setSelectedDoctor(doctor)
    setFormData({
      name: doctor.name,
      specialty: doctor.specialty,
      department: doctor.department,
      departmentId: doctor.departmentId,
      consultationFee: doctor.consultationFee,
      roomNumber: doctor.roomNumber
    })
    setIsEditOpen(true)
  }

  const openSchedule = (doctor: Doctor) => {
    setSelectedDoctor(doctor)
    setIsScheduleOpen(true)
  }

  const toggleSlot = async (day: string, slot: string) => {
    if (!selectedDoctor) return
    const currentSlots = selectedDoctor.availability[day] || []
    const newSlots = currentSlots.includes(slot)
      ? currentSlots.filter(s => s !== slot)
      : [...currentSlots, slot].sort()
    
    await fetch('/api/doctors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedDoctor.id,
        availability: {
          ...selectedDoctor.availability,
          [day]: newSlots
        }
      })
    })
    
    setSelectedDoctor({
      ...selectedDoctor,
      availability: {
        ...selectedDoctor.availability,
        [day]: newSlots
      }
    })
    fetchDoctors()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Doctors Management</h1>
          <p className="text-muted-foreground">Manage hospital doctors and their schedules</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Orthopedic Surgery"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consultation Fee ($)</Label>
                  <Input
                    type="number"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData({ ...formData, consultationFee: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="A-101"
                  />
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">Add Doctor</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell className="font-medium">{doctor.name}</TableCell>
                  <TableCell>{doctor.specialty}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{doctor.department}</Badge>
                  </TableCell>
                  <TableCell>${doctor.consultationFee}</TableCell>
                  <TableCell>{doctor.roomNumber}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openSchedule(doctor)}>
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(doctor)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doctor.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Specialty</Label>
              <Input
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Consultation Fee ($)</Label>
                <Input
                  type="number"
                  value={formData.consultationFee}
                  onChange={(e) => setFormData({ ...formData, consultationFee: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Schedule - {selectedDoctor?.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4 overflow-x-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Click on time slots to toggle availability. Green slots are available.
            </p>
            <div className="grid grid-cols-8 gap-2 min-w-[600px]">
              <div className="font-medium text-sm text-muted-foreground">Time</div>
              {DAYS.map(day => (
                <div key={day} className="font-medium text-sm text-center capitalize">{day.slice(0, 3)}</div>
              ))}
              {TIME_SLOTS.map(slot => (
                <>
                  <div key={`label-${slot}`} className="text-sm text-muted-foreground py-1">{slot}</div>
                  {DAYS.map(day => {
                    const isAvailable = selectedDoctor?.availability[day]?.includes(slot)
                    return (
                      <button
                        key={`${day}-${slot}`}
                        onClick={() => toggleSlot(day, slot)}
                        className={`h-8 rounded text-xs transition-colors ${
                          isAvailable 
                            ? 'bg-accent text-accent-foreground' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {isAvailable ? 'Open' : '-'}
                      </button>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
