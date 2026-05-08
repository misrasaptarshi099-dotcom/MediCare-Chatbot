# WhatsApp Bot Integration for MediCare Chatbot

Connect the existing MediCare AI chatbot to WhatsApp using the **Meta WhatsApp Cloud API** (free tier). Patients will be able to message a WhatsApp Business number and get the same Gemini-powered responses about doctor availability, appointments, insurance, visiting hours, etc.

## How It Will Look on WhatsApp

The experience on WhatsApp will be a **text-based conversation** — the same AI responses the web chatbot gives, but formatted for WhatsApp's messaging format:

- Patient sends: *"Which cardiologist is available tomorrow?"*
- Bot replies with a formatted text message listing doctors, slots, fees
- For appointments: the bot will reply with instructions since WhatsApp doesn't have the web UI's "Book Appointment" button — instead it says *"Reply with BOOK to confirm your appointment with Dr. Sharma at 10:00 AM"*
- Supports all intents: availability, insurance, visiting hours, locations, escalation

> [!IMPORTANT]
> **WhatsApp has no rich UI cards.** The structured results (doctor cards, insurance tables, booking buttons) from the web UI will be converted to **nicely formatted plain text** with emojis for visual structure.

## What You Need to Do (Prerequisites)

Before I write code, you need to set up a free Meta developer account. Here's the step-by-step:

### Step 1: Create a Meta Developer Account
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Sign in with your Facebook account (or create one)
3. Click "My Apps" → "Create App"
4. Select **"Business"** type → give it a name like "MediCare Bot"

### Step 2: Add WhatsApp Product
1. In your app dashboard, click **"Add Product"**
2. Find **"WhatsApp"** and click "Set Up"
3. You'll get a **test phone number** and a **temporary access token** (valid 24h)
4. You'll also get a **Phone Number ID**

### Step 3: Get a Permanent Access Token
1. Go to **Business Settings** → **System Users**
2. Create a system user with "Admin" role
3. Assign the WhatsApp app to this system user
4. Generate a permanent token with `whatsapp_business_messaging` permission

### Step 4: Set Up the Webhook (after I deploy the code)
1. In your WhatsApp app settings, go to **"Configuration"**
2. Set **Callback URL** to: `https://medi-care-chatbot.vercel.app/api/webhook/whatsapp`
3. Set **Verify Token** to any secret string you choose (e.g., `medicare-whatsapp-verify-2026`)
4. Subscribe to the **"messages"** webhook field

### Step 5: Fill in `.env.local` (and Vercel env vars)
Once you have the values from Meta:
```
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_VERIFY_TOKEN=medicare-whatsapp-verify-2026
```

> [!WARNING]
> The **temporary test token** from Step 2 expires in 24 hours. For production, you MUST create a permanent token via Step 3. Also, on the test number you can only message phone numbers you've manually added to the "allowed" list — to message anyone, you'll need to verify a real business phone number.

---

## Proposed Changes

### WhatsApp Webhook Route

#### [NEW] [route.ts](file:///c:/Users/misra/Desktop/PROJECTS/Hospital-AI-Chatbot-main/app/api/webhook/whatsapp/route.ts)

This is the core integration file. It handles:

1. **`GET /api/webhook/whatsapp`** — Webhook verification (Meta sends a challenge to confirm your URL)
2. **`POST /api/webhook/whatsapp`** — Receives incoming messages from WhatsApp, calls the existing Gemini-powered chat logic, and sends back a formatted reply

Key design decisions:
- **Reuses the existing chat API logic internally** — calls the same `buildHospitalContext()`, `getChatSession()`, `saveChatSession()`, and Gemini functions. This means WhatsApp chats are saved to Firestore just like web chats.
- **Phone-to-email mapping** — WhatsApp users are identified by phone number. For chat history persistence, we'll use the phone number as the key (e.g., `wa-919876543210@whatsapp`). If a patient later logs in on the web with the same email, their histories are separate (this is intentional — merging can be added later).
- **Message formatting** — Converts the structured JSON results (doctor cards, insurance tables) into WhatsApp-friendly text with emojis.
- **Handles appointment booking** — Since WhatsApp has no buttons, uses a conversational flow: AI shows slots → patient replies "BOOK 10:00 AM" → bot books it.

---

### Environment & Config Updates

#### [MODIFY] [.env.local](file:///c:/Users/misra/Desktop/PROJECTS/Hospital-AI-Chatbot-main/.env.local)

The WhatsApp env vars are already stubbed out — just need values filled in by you.

#### [MODIFY] [.gitignore](file:///c:/Users/misra/Desktop/PROJECTS/Hospital-AI-Chatbot-main/.gitignore)

Verify `.env.local` is gitignored (it already is).

---

## Open Questions

> [!IMPORTANT]
> **Do you already have a Meta Developer account?** If not, please create one first — I can't proceed with testing until the webhook URL is registered with Meta.

> [!IMPORTANT]
> **Do you want the WhatsApp bot to support appointment booking?** On the web you have the fancy booking modal. On WhatsApp, booking would be text-based ("Reply BOOK to confirm"). Should I include this, or keep it read-only (just answering questions)?

> [!IMPORTANT]
> **Language:** Should the WhatsApp bot auto-detect language like the web bot (Hindi, Tamil, etc.), or should it default to English?

---

## Verification Plan

### Automated Tests
- After deployment, I'll verify the webhook responds to Meta's GET verification challenge
- Test the POST handler with a simulated WhatsApp webhook payload locally

### Manual Verification
1. You register the webhook URL in Meta Developer Console
2. Send a test message from the WhatsApp test number
3. Verify the bot responds on WhatsApp
4. Check Firestore to confirm chat history was saved
