'use client'

import Link from 'next/link'
import { Stethoscope } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm } from '@/components/login-form'

export default function PatientLoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MediCare</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
        <LoginForm />
      </main>
    </div>
  )
}
