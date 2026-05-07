'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Insurance {
  id: string
  name: string
  proceduresCovered: string[]
  coveragePercentage: number
  networkType: string
  contactNumber: string
}

const AVAILABLE_PROCEDURES = [
  'knee-consultation', 'knee-surgery', 'heart-checkup', 'heart-surgery',
  'mri-scan', 'x-ray', 'ct-scan', 'pediatric-checkup', 'neuro-consultation',
  'neuro-surgery', 'ultrasound', 'blood-test'
]

export default function InsurancePage() {
  const [insurers, setInsurers] = useState<Insurance[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedInsurer, setSelectedInsurer] = useState<Insurance | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    proceduresCovered: [] as string[],
    coveragePercentage: 70,
    networkType: 'In-Network',
    contactNumber: ''
  })

  useEffect(() => {
    fetchInsurers()
  }, [])

  const fetchInsurers = async () => {
    const res = await fetch('/api/insurance')
    const data = await res.json()
    setInsurers(data)
  }

  const handleAdd = async () => {
    await fetch('/api/insurance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    setIsAddOpen(false)
    resetForm()
    fetchInsurers()
  }

  const handleEdit = async () => {
    if (!selectedInsurer) return
    await fetch('/api/insurance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedInsurer.id, ...formData })
    })
    setIsEditOpen(false)
    setSelectedInsurer(null)
    resetForm()
    fetchInsurers()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this insurance partner?')) return
    await fetch(`/api/insurance?id=${id}`, { method: 'DELETE' })
    fetchInsurers()
  }

  const openEdit = (insurer: Insurance) => {
    setSelectedInsurer(insurer)
    setFormData({
      name: insurer.name,
      proceduresCovered: insurer.proceduresCovered,
      coveragePercentage: insurer.coveragePercentage,
      networkType: insurer.networkType,
      contactNumber: insurer.contactNumber
    })
    setIsEditOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      proceduresCovered: [],
      coveragePercentage: 70,
      networkType: 'In-Network',
      contactNumber: ''
    })
  }

  const toggleProcedure = (proc: string) => {
    setFormData(prev => ({
      ...prev,
      proceduresCovered: prev.proceduresCovered.includes(proc)
        ? prev.proceduresCovered.filter(p => p !== proc)
        : [...prev.proceduresCovered, proc]
    }))
  }

  const FormContent = () => (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Insurance Provider Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="ABC Insurance"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Coverage Percentage</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.coveragePercentage}
            onChange={(e) => setFormData({ ...formData, coveragePercentage: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Network Type</Label>
          <Input
            value={formData.networkType}
            onChange={(e) => setFormData({ ...formData, networkType: e.target.value })}
            placeholder="In-Network / Preferred"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Contact Number</Label>
        <Input
          value={formData.contactNumber}
          onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
          placeholder="+1-800-555-0000"
        />
      </div>
      <div className="space-y-2">
        <Label>Covered Procedures</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
          {AVAILABLE_PROCEDURES.map(proc => (
            <Badge
              key={proc}
              variant={formData.proceduresCovered.includes(proc) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleProcedure(proc)}
            >
              {proc.replace('-', ' ')}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insurance Partners</h1>
          <p className="text-muted-foreground">Manage insurance providers and coverage</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Insurance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Insurance Partner</DialogTitle>
            </DialogHeader>
            <FormContent />
            <Button onClick={handleAdd} className="w-full mt-4">Add Insurance</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Procedures</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.map((insurer) => (
                <TableRow key={insurer.id}>
                  <TableCell className="font-medium">{insurer.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{insurer.coveragePercentage}%</Badge>
                  </TableCell>
                  <TableCell>{insurer.networkType}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {insurer.proceduresCovered.slice(0, 3).map(proc => (
                        <Badge key={proc} variant="outline" className="text-xs">
                          {proc.replace('-', ' ')}
                        </Badge>
                      ))}
                      {insurer.proceduresCovered.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{insurer.proceduresCovered.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{insurer.contactNumber}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(insurer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(insurer.id)}>
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
            <DialogTitle>Edit Insurance Partner</DialogTitle>
          </DialogHeader>
          <FormContent />
          <Button onClick={handleEdit} className="w-full mt-4">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
