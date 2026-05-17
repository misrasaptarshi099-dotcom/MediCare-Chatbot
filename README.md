# 🏥 MediCare AI - Intelligent Hospital Management & Chatbot System

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat&logo=google&logoColor=white)

An advanced, AI-powered hospital management platform and patient portal. MediCare AI seamlessly blends an intelligent generative chatbot (powered by Google's Gemini) with a secure, serverless backend to automate patient support, appointment booking, and diagnostic reporting.

---

## ✨ Key Features

### 🤖 AI Patient Assistant (Gemini API)
- **Natural Language Understanding:** Parses patient queries contextually to understand medical needs.
- **Dynamic Context:** Automatically retrieves real-time hospital schedules, doctor availability, and the patient's existing appointments.
- **Smart Escalation:** Automatically detects unsupported complex medical queries and escalates them to human hospital administrators.

### 🏥 Patient Portal
- **Secure Authentication:** Identity verification and data scoping via Firebase Auth.
- **Self-Service Appointments:** Patients can securely book, view, reschedule, or cancel appointments.
- **Diagnostic Results Delivery:** Fully automated system to view and download Blood Test and X-Ray reports.

### 🛡️ Secure Admin Dashboard
- **Cryptographic Authentication:** Protected by 256-bit secure session tokens and OTPs.
- **Centralized Management:** Admins can manage doctors, view waitlists, send medical reports via email, and review escalated AI queries.
- **Real-Time Analytics:** View hospital revenue, appointment statistics, and department loads.

---

## 🔒 Security Posture

This codebase has undergone a **Deep-Dive Security Audit** and features enterprise-grade protections:
- **Strict Firestore Rules (Default Deny):** Direct database access is blocked. Users can mathematically only read/write documents where their Firebase UID matches the ownership tag.
- **Anti-Spoofing API Endpoints:** All routes enforce JWT Bearer Token validation against the Firebase Admin SDK.
- **Timing-Attack Resistance:** Webhooks use `crypto.timingSafeEqual` constant-time comparisons.
- **Session Protections:** Cookies are marked `HttpOnly`, `SameSite=Lax`, and strictly scoped to 24-hour TTLs in the backend.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Framer Motion (Animations), Lucide React (Icons).
- **Backend:** Next.js Serverless API Routes, Node.js `crypto`.
- **Database & Auth:** Firebase Cloud Firestore, Firebase Authentication, Firebase Admin SDK.
- **AI Integration:** Google Generative AI (Gemini Flash).
- **Email:** Nodemailer.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A Firebase Project (with Firestore and Authentication enabled)
- A Google Gemini API Key

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/misrasaptarshi099-dotcom/MediCare-Chatbot.git
cd MediCare-Chatbot
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory and populate it with your Firebase and Gemini credentials:

```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase Client Configuration (For Frontend Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (For Backend Security)
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\n-----END PRIVATE KEY-----\n"

# Hospital Webhooks & Admin Emails
DOCTOR_UPDATE_WEBHOOK_SECRET=your_secure_random_string
EMAIL_USER=your_hospital_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### 4. Run Locally

Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the patient portal, and `/admin` for the management dashboard.

---

## 📜 License

This project is proprietary software belonging to MediCare Hospital. All rights reserved.
