# MediCare AI - Enterprise Hospital Management Ecosystem

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat&logo=google&logoColor=white)
![WhatsApp API](https://img.shields.io/badge/WhatsApp-25D366?style=flat&logo=whatsapp&logoColor=white)

**MediCare AI** is a highly secure, AI-powered hospital management platform. By integrating modern web frameworks with Google's Gemini LLMs and the Meta WhatsApp Cloud API, it automates patient intake, schedules clinical appointments, delivers medical reports, and handles administrative workflows under a unified, thread-safe architecture.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Environment Setup](#-environment-setup)
- [Copyright & License](#-copyright--license)

---

## 🌟 Key Features

### 📱 AI-Driven WhatsApp Agent
- **Automated Scheduling:** Handles conversational slot discovery, booking, rescheduling, and cancellations via natural language processing.
- **Dynamic Catalog Lookup:** Leverages Firestore database querying to present live doctor fees, department-specific consultation slots, and lab pricing without hardcoded structures.
- **Secure Transactional Booking:** Implements atomic document transactions (`runTransaction`) to guarantee slot locks, preventing double-bookings or concurrent race conditions.

### 🏥 Secure Patient Web Portal
- **Modern Performance:** Built on Next.js 15 App Router, featuring optimized routing, clean styling, and responsive user interfaces.
- **Self-Service Actions:** Allows secure authentication (Email/Phone OTP), viewing booking history, updating billing statuses, and downloading digital diagnostics/lab reports.

### 🏢 Enterprise Admin Control Center
- **Operational Oversight:** Provides hospital staff with full visibility into appointment statuses, department schedules, active waitlists, and medical queue metrics.
- **Strict Edge Middleware:** Enforces robust CSRF protection and unauthenticated request interception at the network edge (`middleware.ts`), guaranteeing zero data leakage.
- **Integrated Email Delivery:** Automates clinical report dispatch, critical patient reminders, and auth verification tokens utilizing highly detailed email templates.
- **Atomic Cron Dispatcher:** Nightly background jobs run concurrently with strict atomic operations to prevent duplicate emails or race conditions across instances.

---

## 🛠️ Architecture & Tech Stack

- **Framework:** Next.js 15 (React 19, TypeScript)
- **AI Engine:** Google Generative AI (Gemini SDK with function/tool calling capabilities)
- **Database & Identity:** Firebase Firestore (NoSQL), Firebase Authentication, Firebase Admin SDK
- **Communication Pipelines:** Meta WhatsApp Cloud API, SMTP Mailers (Nodemailer)

---

## ⚙️ Environment Setup

```
# =========================================================================
# Google Gemini AI Config
# =========================================================================
GEMINI_API_KEY=your_gemini_api_key

# =========================================================================
# Firebase Web Client SDK Configuration
# =========================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_client_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_auth_domain.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# =========================================================================
# Firebase Admin SDK Configuration (Private Keys & Email)
# =========================================================================
FIREBASE_CLIENT_EMAIL=your_firebase_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\n-----END PRIVATE KEY-----\n"

# =========================================================================
# SMTP Email Settings (OTP & Diagnostic Report Dispatch)
# =========================================================================
EMAIL_USER=your_smtp_sender_username@gmail.com
EMAIL_PASS=your_smtp_app_password

# =========================================================================
# Meta WhatsApp Cloud API Integration
# =========================================================================
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_system_user_access_token
WHATSAPP_APP_SECRET=your_facebook_app_secret
WHATSAPP_VERIFY_TOKEN=your_custom_webhook_verify_token

# =========================================================================
# Cron Scheduling & Security (Automated Appointment Reminders)
# =========================================================================
CRON_SECRET=your_shared_cron_api_secret

```

---

## 📜 Copyright & License

This software, including all its source code, design, and architecture, is the exclusive intellectual property of **Saptarshi Misra (@misrasaptarshi099-dotcom)**. Unauthorized copying, modification, distribution, or commercial use is strictly prohibited.
