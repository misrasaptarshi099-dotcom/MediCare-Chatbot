'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface PatientContextType {
  uid: string
  name: string
  email?: string
  phone?: string
  authProviders: string[]
}

interface PatientProviderProps {
  children: React.ReactNode
  initialPatient: PatientContextType | null
}

const PatientContext = createContext<{
  patient: PatientContextType | null
  setPatient: React.Dispatch<React.SetStateAction<PatientContextType | null>>
} | undefined>(undefined)

export function PatientProvider({ children, initialPatient }: PatientProviderProps) {
  const [patient, setPatient] = useState<PatientContextType | null>(initialPatient)

  useEffect(() => {
    setPatient(initialPatient)
  }, [initialPatient])

  return (
    <PatientContext.Provider value={{ patient, setPatient }}>
      {children}
    </PatientContext.Provider>
  )
}

export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}
