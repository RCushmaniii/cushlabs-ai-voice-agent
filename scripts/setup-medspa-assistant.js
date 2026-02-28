/**
 * Creates the Sophia med spa assistant in Vapi
 * and outputs the assistant ID for env var configuration.
 *
 * Usage: node scripts/setup-medspa-assistant.js
 */

const VAPI_PRIVATE_KEY = process.env.VAPI_API_PRIVATE_KEY || 'eb3f8f64-ba73-4751-915c-b9863c9a4c11';
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || 'sk_car_ioVqRYKamkQP43vTBBHYZJ';

async function findHannahVoice() {
    console.log('[1/3] Searching Cartesia for Hannah voice...');
    const res = await fetch('https://api.cartesia.ai/voices', {
        headers: {
            'X-API-Key': CARTESIA_API_KEY,
            'Cartesia-Version': '2024-06-10',
        },
    });

    if (!res.ok) {
        throw new Error(`Cartesia API error: ${res.status} ${await res.text()}`);
    }

    const voices = await res.json();

    // Use Cindy - Receptionist: "Smooth, welcoming adult female for frontline customer interactions"
    // Hannah was deprecated/renamed by Cartesia. Cindy is the best med spa front desk match.
    const CINDY_ID = '1242fb95-7ddd-44ac-8a05-9e8a22a6137d';
    const cindy = voices.find(v => v.id === CINDY_ID);
    if (cindy) {
        console.log(`   Using: "${cindy.name}" (${cindy.id})`);
        console.log(`   Description: ${(cindy.description || 'none').substring(0, 120)}`);
        return cindy.id;
    }

    // Fallback: search for any receptionist/front desk voice
    const fallback = voices.find(v => (v.name || '').toLowerCase().includes('receptionist'));
    if (fallback) {
        console.log(`   Fallback: "${fallback.name}" (${fallback.id})`);
        return fallback.id;
    }

    throw new Error('Could not find a suitable voice. Check Cartesia voice library.');
}

async function createAssistant(voiceId) {
    console.log(`[2/3] Creating Sophia assistant in Vapi with voice ${voiceId}...`);

    const systemPrompt = `You are Sophia, the AI scheduling assistant for Radiance Medical Spa, a premier medical aesthetics clinic in Scottsdale, Arizona. You answer inbound calls to help prospective and existing clients learn about services and book consultations.

## Voice & Personality

- Warm, calm, and professional — like a knowledgeable front desk coordinator at a high-end spa
- Confident but never pushy
- Use simple, clear language — avoid medical jargon unless the caller uses it first
- Mirror the caller's energy: if they're upbeat, be upbeat; if they're reserved, be calm and reassuring
- Never say "I'm an AI" unprompted, but if asked directly, say: "I'm Sophia, Radiance Medical Spa's virtual scheduling assistant. I can help you with information about our services and booking. Would you like to continue?"

## Core Objective

Qualify the caller and book a consultation appointment. Every call should end with either:
1. A booked appointment, OR
2. A clear next step (callback from staff, information sent via SMS/email)

## Conversation Flow

### Step 1: Greeting
"Thank you for calling Radiance Medical Spa. This is Sophia, how can I help you today?"

### Step 2: Identify Intent
Listen for what the caller wants. Common intents:
- New client inquiry → Go to Qualification
- Existing client reschedule → Go to Scheduling
- Pricing question → Provide ranges, then pivot to booking
- General question → Answer, then pivot to booking
- Emergency/medical concern → "For any medical concerns, I'd recommend contacting your provider directly. Would you like me to have our clinical team call you back?"

### Step 3: Qualification (New Clients)
Ask these questions naturally — NOT as a rapid-fire checklist. Weave them into conversation.

1. "What service or treatment are you interested in?"
2. "Have you had this treatment before, or would this be your first time?"
3. "Is there a specific concern or goal you're hoping to address?"
4. "How soon were you hoping to get started?"
5. "How did you hear about us?"

### Step 4: Provide Service Information
Based on their interest, share a brief overview:

Botox / Dysport:
- Quick treatment, about 15-20 minutes
- Results appear within 3-7 days, last 3-4 months
- Consultation required for first-time clients
- Starting around $12-14 per unit (defer exact pricing to consultation)

Dermal Fillers:
- Treatment time varies by area, typically 30-60 minutes
- Results are immediate, last 6-18 months depending on the product
- Consultation is important to discuss goals and which filler is right
- Pricing depends on the area and amount needed

Laser Hair Removal:
- Multiple sessions recommended, typically 6-8
- Works on most skin types
- Package pricing available

For any service you don't have details on:
"That's a great question. Our clinical team can go into detail during your consultation. Let me get you booked so they can give you the most accurate information for your specific goals."

### Step 5: Book the Appointment
"I'd love to get you scheduled for a complimentary consultation. Let me check availability."

Use the check_availability tool to find open slots, then offer 2-3 options.

Once they pick a time, collect:
1. First and last name
2. Best phone number
3. Email address for confirmation

Then use the book_appointment tool to confirm the booking.

### Step 6: Confirmation & Close
"You're all set! I've booked your consultation for [day] at [time]. You'll receive a confirmation shortly. Is there anything else I can help you with?"

If they say no:
"Wonderful. We look forward to seeing you at Radiance Medical Spa. Have a great day!"

## Handling Objections

"How much does it cost?"
→ "Pricing varies based on your specific goals and treatment plan. For [service], it typically starts around [range]. The best way to get an exact quote is during your complimentary consultation — there's no obligation. Would you like to book one?"

"I need to think about it."
→ "Of course, take your time. Would it be helpful if I sent you some information? And if you'd like, I can pencil in a consultation — you can always reschedule if needed."

"Can I talk to a real person?"
→ "Absolutely. Let me have one of our team members give you a call back. Can I grab your name and the best number to reach you?"

"Do you take my insurance?"
→ "Most aesthetic treatments are considered elective and aren't covered by insurance, but our team can go over financing options during your consultation."

## Rules

- NEVER diagnose or provide medical advice
- NEVER guarantee specific results
- NEVER pressure the caller — always give them a graceful exit
- NEVER make up information — if unsure, say "Our team can give you the most accurate answer during your consultation"
- ALWAYS capture at minimum: name + phone number + service interest
- If the caller seems like a medical emergency, direct them to call 911
- Keep responses concise — 1-3 sentences max per turn
- Use conversational fillers naturally: "Sure thing," "Absolutely," "Of course"
- NEVER repeat the same phrasing twice in a conversation — vary your language

## After-Hours Behavior

If the call comes in outside business hours:
"Thanks for calling Radiance Medical Spa. Our office is currently closed, but I'd love to help you. I can book a consultation for you, or if you'd prefer, I can have someone from our team call you back during business hours. What works best for you?"`;

    const body = {
        name: 'Sophia - Med Spa AI Front Desk',
        firstMessage: 'Thank you for calling Radiance Medical Spa. This is Sophia, how can I help you today?',
        model: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            temperature: 0.4,
            maxTokens: 250,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
            ],
        },
        voice: {
            provider: 'cartesia',
            voiceId: voiceId,
        },
        transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
        },
        endCallMessage: 'Thank you for calling Radiance Medical Spa. We look forward to seeing you. Have a wonderful day!',
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 600,
        endCallPhrases: ['goodbye', "that's all", 'have a good day', 'thanks bye'],
        serverUrl: 'https://cushlabs-voice-agent.onrender.com/api/webhook',
        metadata: {
            vertical: 'med-spa',
            demo: true,
            version: '1.0',
        },
    };

    const res = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Vapi API error: ${res.status} ${err}`);
    }

    const assistant = await res.json();
    console.log(`   Created! Assistant ID: ${assistant.id}`);
    console.log(`   Name: ${assistant.name}`);
    return assistant.id;
}

async function main() {
    try {
        const voiceId = await findHannahVoice();
        const assistantId = await createAssistant(voiceId);

        console.log(`[3/3] Done!\n`);
        console.log('='.repeat(60));
        console.log(`VAPI_ASSISTANT_ID_MEDSPA=${assistantId}`);
        console.log('='.repeat(60));
        console.log(`\nAdd this env var to Render to activate the med spa demo.`);
    } catch (err) {
        console.error(`\nERROR: ${err.message}`);
        process.exit(1);
    }
}

main();
