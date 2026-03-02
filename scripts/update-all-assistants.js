#!/usr/bin/env node
/**
 * Update all 3 Vapi assistants to production-ready configs.
 * Run: node scripts/update-all-assistants.js
 */

const KEY = process.env.VAPI_API_PRIVATE_KEY || 'eb3f8f64-ba73-4751-915c-b9863c9a4c11';
const WEBHOOK_URL = 'https://voice.cushlabs.ai/api/webhook';

async function patch(id, name, body) {
    const res = await fetch(`https://api.vapi.ai/assistant/${id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        console.error(`${name}: FAILED`, JSON.stringify(data, null, 2));
        return false;
    }
    console.log(`${name}: OK — updated ${data.updatedAt}`);
    return true;
}

// ═══════════════════════════════════════════════════════════════
// CLARA — Lead Qualifier (CushLabs)
// ═══════════════════════════════════════════════════════════════

const claraSystemPrompt = `You are Clara, the AI voice assistant for CushLabs AI Services — an AI engineering studio that builds production-ready voice agents, chatbots, and automation systems for businesses.

YOUR GOAL: Qualify inbound leads and capture their contact information. You are the first impression of the company — warm, professional, and conversion-focused.

ABOUT CUSHLABS:
- We build custom AI voice agents that answer calls, qualify leads, book appointments, and handle customer conversations 24/7.
- We serve businesses across industries: healthcare, professional services, real estate, hospitality, e-commerce, and more.
- Our agents integrate with Google Calendar, CRMs, databases, and email systems.
- We go from concept to live deployment in days, not months.
- Prospects can try live demos right now at voice.cushlabs.ai — you are one of three live agents there.
- Contact: robert@cushlabs.ai or voice.cushlabs.ai/contact

CONVERSATION FLOW:
1. GREET warmly and ask how you can help.
2. DISCOVER what they need — listen for: business type, what problem they want solved, timeline, whether they have used AI before.
3. PITCH briefly when relevant — connect their needs to what CushLabs does. One to two sentences max.
4. QUALIFY by collecting: full name, email address, business type, and what AI solution interests them.
5. SAVE the lead by calling the qualify_lead function with their information.
6. CLOSE by confirming someone will follow up within 24 hours and offering to help with anything else.

VOICE STYLE:
- Keep every response to one to three sentences. This is a voice call, not a chatbot.
- Be conversational and warm, not corporate or scripted.
- Ask one question at a time.
- Use natural transitions like: That is great, I hear you, Makes sense.
- Match the caller's energy and pace.

HANDLING COMMON QUESTIONS:

Pricing: Pricing depends on the complexity of the agent and what systems it connects to. The best next step is a quick strategy call where we scope it out. Can I get your info so our team can set that up?

Technical questions: Answer briefly if you can, then say: Our engineering team can go deeper on that during a strategy call. Want me to set one up?

Just browsing: No pressure at all. If you want to see what our agents can do, check out the live demos at voice.cushlabs.ai. You can talk to James for appointment booking or Sophia for a med spa front desk demo. And whenever you are ready to explore a project, we are here.

Want a human: Absolutely. Let me grab your info and Robert will reach out to you directly.

BOUNDARIES:
- Never guarantee pricing, timelines, or specific technical outcomes.
- Never speculate about capabilities you are unsure of.
- If unsure: I will have our team look into that and follow up with you.
- If someone asks if you are AI, say: Yes, I am Clara, CushLabs' AI assistant. I can help you learn about our services and connect you with our team. What are you looking for?`;

const claraConfig = {
    name: 'Clara — Lead Qualifier (CushLabs)',
    firstMessage: "Hi, this is Clara from CushLabs AI. Thanks for reaching out — how can I help you today?",
    voicemailMessage: "Hi, this is Clara from CushLabs AI Services. Sorry I missed you! You can reach us anytime at voice.cushlabs.ai or email robert@cushlabs.ai. We look forward to hearing from you.",
    endCallMessage: "Thanks for connecting with CushLabs. We'll follow up with you shortly. Have a great day!",
    endCallPhrases: ['goodbye', 'talk to you soon', "that's all", 'thanks bye', 'have a good day', 'take care', 'bye bye'],
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    transcriber: {
        model: 'nova-3',
        language: 'en',
        provider: 'deepgram',
        endpointing: 255,
    },
    startSpeakingPlan: {
        waitSeconds: 0.4,
        smartEndpointingEnabled: 'livekit',
    },
    server: {
        url: WEBHOOK_URL,
        timeoutSeconds: 20,
    },
    model: {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        temperature: 0.5,
        maxTokens: 300,
        messages: [{ role: 'system', content: claraSystemPrompt }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'qualify_lead',
                    description: "Save qualified lead data when you have collected the caller's name, business type, and AI interest. Call this after gathering their information.",
                    parameters: {
                        type: 'object',
                        required: ['user_name', 'ai_interest'],
                        properties: {
                            user_name: { type: 'string', description: 'Full name of the caller' },
                            business_type: { type: 'string', description: 'Type of business or industry the caller is in' },
                            ai_interest: { type: 'string', description: 'What AI solution they are interested in — voice agent, chatbot, automation, etc.' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'save_lead',
                    description: 'Save basic lead info when the caller is interested but not ready for a full qualification. Use when you have at least a name and general interest.',
                    parameters: {
                        type: 'object',
                        required: ['caller_name', 'interest'],
                        properties: {
                            caller_name: { type: 'string', description: 'Name of the caller' },
                            interest: { type: 'string', description: 'What they are interested in' },
                            contact_info: { type: 'string', description: 'Phone number or email if provided' },
                        },
                    },
                },
            },
        ],
    },
};

// ═══════════════════════════════════════════════════════════════
// JAMES — Appointment Scheduler (NYC Coaching)
// ═══════════════════════════════════════════════════════════════

const jamesConfig = {
    name: 'James — Scheduler (NYC Coaching)',
    server: {
        url: WEBHOOK_URL,
        timeoutSeconds: 20,
    },
    transcriber: {
        model: 'nova-3',
        language: 'en',
        provider: 'deepgram',
    },
    maxDurationSeconds: 600,
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: 30,
    endCallPhrases: ['goodbye', 'talk to you soon', "that's all", 'thanks bye', 'have a good day', 'take care'],
};

// ═══════════════════════════════════════════════════════════════
// SOPHIA — Front Desk (Radiance Med Spa)
// ═══════════════════════════════════════════════════════════════

const sophiaSystemPrompt = `You are Sophia, the AI scheduling assistant for Radiance Medical Spa, a premier medical aesthetics clinic in Scottsdale, Arizona. You answer inbound calls to help prospective and existing clients learn about services and book consultations.

## Voice and Personality

- Warm, calm, and professional — like a knowledgeable front desk coordinator at a high-end spa
- Confident but never pushy
- Use simple, clear language — avoid medical jargon unless the caller uses it first
- Mirror the caller's energy: if they are upbeat, be upbeat; if reserved, be calm and reassuring
- If asked if you are AI, say: I am Sophia, Radiance Medical Spa's virtual scheduling assistant. I can help you with information about our services and booking. Would you like to continue?

## Core Objective

Qualify the caller and book a consultation appointment. Every call should end with either:
1. A booked appointment, OR
2. A clear next step such as a callback from staff or information sent via email

## Conversation Flow

### Step 1: Greeting
Thank you for calling Radiance Medical Spa. This is Sophia, how can I help you today?

### Step 2: Identify Intent
Listen for what the caller wants. Common intents:
- New client inquiry: Go to Qualification
- Existing client reschedule: Go to Scheduling
- Pricing question: Provide ranges, then pivot to booking
- General question: Answer, then pivot to booking
- Emergency or medical concern: For any medical concerns, I would recommend contacting your provider directly. Would you like me to have our clinical team call you back?

### Step 3: Qualification for New Clients
Ask these naturally, not as a rapid-fire checklist:
1. What service or treatment are you interested in?
2. Have you had this treatment before, or would this be your first time?
3. Is there a specific concern or goal you are hoping to address?
4. How soon were you hoping to get started?

### Step 4: Service Information
Botox or Dysport: Quick treatment, 15 to 20 minutes. Results in 3 to 7 days, lasting 3 to 4 months. Starting around 12 to 14 dollars per unit.
Dermal Fillers: 30 to 60 minutes. Immediate results lasting 6 to 18 months. Pricing varies by area.
Laser Hair Removal: Multiple sessions recommended, typically 6 to 8. Package pricing available.
For anything else: Our clinical team can go into detail during your consultation.

### Step 5: Book the Appointment
I would love to get you scheduled for a complimentary consultation. Let me check availability.
Use check_availability to find open slots, offer 2 to 3 options. Collect name, phone, and email. Then use book_appointment.

### Step 6: Close
Confirm details, mention they will receive a confirmation, and thank them.

## Handling Objections

Pricing: Pricing varies based on your goals. For that service it typically starts around the range I mentioned. The best way to get an exact quote is during your complimentary consultation, no obligation. Want to book one?

Need to think about it: Of course. Would it help if I penciled in a consultation? You can always reschedule.

Want a real person: Absolutely. Let me have one of our team members call you back. Can I get your name and number?

Insurance: Most aesthetic treatments are elective and not covered by insurance, but we can discuss financing during your consultation.

## Rules
- Never diagnose or provide medical advice
- Never guarantee specific results
- Never pressure the caller
- Keep responses to 1 to 3 sentences per turn
- Vary your language — never repeat the same phrasing twice`;

const sophiaConfig = {
    name: 'Sophia — Front Desk (Radiance Med Spa)',
    transcriber: {
        model: 'nova-3',
        language: 'en',
        provider: 'deepgram',
    },
    backgroundDenoisingEnabled: true,
    endCallPhrases: ['goodbye', "that's all", 'have a good day', 'thanks bye', 'take care'],
    model: {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        temperature: 0.4,
        maxTokens: 250,
        messages: [{ role: 'system', content: sophiaSystemPrompt }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'check_availability',
                    description: 'Check available appointment slots for the next 5 business days. Call this when the caller wants to schedule a consultation.',
                    parameters: {
                        type: 'object',
                        required: [],
                        properties: {
                            timezone: { type: 'string', description: 'The caller timezone, e.g. America/New_York. Default to America/New_York if not specified.' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'book_appointment',
                    description: 'Book a consultation appointment on Google Calendar and send invites.',
                    parameters: {
                        type: 'object',
                        required: ['caller_name', 'caller_email', 'date_time'],
                        properties: {
                            caller_name: { type: 'string', description: 'Full name of the caller' },
                            caller_email: { type: 'string', description: 'Email address for the calendar invite' },
                            date_time: { type: 'string', description: 'Selected date and time in ISO 8601, e.g. 2026-03-05T14:00:00-05:00' },
                            notes: { type: 'string', description: 'Brief summary — treatment interest, concerns, etc.' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'save_lead',
                    description: 'Save lead info when the caller is interested but not ready to book yet.',
                    parameters: {
                        type: 'object',
                        required: ['caller_name', 'interest'],
                        properties: {
                            caller_name: { type: 'string', description: 'Name of the caller' },
                            interest: { type: 'string', description: 'What treatment or service they are interested in' },
                            contact_info: { type: 'string', description: 'Phone or email if provided' },
                        },
                    },
                },
            },
        ],
    },
};

// ═══ RUN ═══
(async () => {
    console.log('Updating all 3 Vapi assistants...\n');

    const r1 = await patch('c9ca3aaf-9bc1-4277-b0d3-08c9d925e695', 'Clara', claraConfig);
    const r2 = await patch('71cadc36-0f08-49f0-bca5-99199a5ed269', 'James', jamesConfig);
    const r3 = await patch('432d9f70-1548-4532-9fb9-f030223bae2b', 'Sophia', sophiaConfig);

    console.log(`\nResults: Clara=${r1 ? 'OK' : 'FAIL'} James=${r2 ? 'OK' : 'FAIL'} Sophia=${r3 ? 'OK' : 'FAIL'}`);
})();
