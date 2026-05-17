import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MediCare Hospital - AI Assistant',
  description: 'AI-powered hospital information assistant for patients and staff to book appointments, check diagnostics, and get medical support.',
  keywords: ['hospital', 'healthcare', 'medical appointments', 'diagnostic tests', 'AI assistant', 'MediCare'],
  authors: [{ name: 'MediCare Hospital' }],
  creator: 'MediCare Hospital',
  publisher: 'MediCare Hospital',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'MediCare Hospital - AI Assistant',
    description: 'AI-powered hospital information assistant for patients and staff. Manage appointments, lab reports, and more.',
    url: 'https://medicare-chatbot.vercel.app',
    siteName: 'MediCare Hospital',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
  },
}

import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
