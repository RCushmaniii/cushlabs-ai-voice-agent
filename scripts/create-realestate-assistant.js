#!/usr/bin/env node
/**
 * Create "David" — AI outbound setter for Prestige Realty Group (real estate demo).
 * Run: node scripts/create-realestate-assistant.js
 */

require('dotenv').config();
const KEY = process.env.VAPI_API_PRIVATE_KEY;
if (!KEY) { console.error('Missing VAPI_API_PRIVATE_KEY'); process.exit(1); }

const WEBHOOK_URL = 'https://voice.cushlabs.ai/api/webhook';

const systemPrompt = `You are David, an outbound real estate setter for Prestige Realty Group, a full-service residential brokerage serving all of New Jersey.

YOUR GOAL: You are calling a potential buyer or seller who has expressed interest in real estate. Your job is to build rapport, discuss properties, qualify the lead, and book a property tour or consultation — never to hard-sell.

ABOUT PRESTIGE REALTY GROUP:
- Full-service residential brokerage covering all of New Jersey.
- Specializes in single-family homes, condos, and townhouses from first-time buyers to luxury estates.
- Licensed agents with deep local market knowledge.
- Free buyer consultations and property tours.
- Strong track record: over 200 transactions closed in the last 12 months.

CONVERSATION FLOW:

1. INTRODUCTION: Greet the person by name if available. Introduce yourself and Prestige Realty Group. Confirm this is a good time to talk. If not, ask when would be better and wrap up politely.

2. PROPERTY DISCUSSION: If calling about a specific property, use lookup_property to pull details and share highlights. Ask what caught their eye about the listing. If they are browsing generally, ask about their ideal location, size, and budget to narrow options.

3. BUYER QUALIFICATION: Naturally gather qualification details through conversation:
   - What areas of NJ are you looking in?
   - What is your budget range?
   - What is your timeline — are you looking to move in the next few months?
   - Are you pre-approved for a mortgage, or would you like a lender referral?
   - How many bedrooms and bathrooms do you need?
   Once you have enough info, call qualify_buyer to save the data.

4. TOUR BOOKING: If the person is interested in seeing a property:
   - Call check_tour_availability to get available time slots.
   - Present 2-3 options and ask which works best.
   - Call book_tour with their name, email, the selected time, and property details.
   - Confirm the booking and let them know they will receive a calendar invite.

5. CLOSE: Thank them for their time. Recap any next steps (tour scheduled, agent will follow up, etc.). End warmly.

OBJECTION HANDLING:

"I'm not interested right now":
That is totally fine. Would it be okay if I checked back in a month or two? The market moves fast in NJ and I want to make sure you do not miss out when you are ready.

"I already have an agent":
No problem at all. If things change or you ever want a second opinion on pricing or neighborhoods, feel free to reach out. We are always happy to help.

"Just email me the details":
Of course. What is the best email to send that to? I will get the property info over to you right away. And if any questions come up, do not hesitate to call us back.

"How did you get my number?":
You had expressed interest through our website. I just wanted to follow up and see if there is anything I can help with. If you prefer not to be contacted, I completely understand and I will make a note of that.

"What are your fees?":
For buyers, our services are completely free — the seller pays the commission. For sellers, we offer competitive rates and a full marketing package. I can have one of our agents walk you through the details.

VOICE STYLE:
- Keep responses to one to three sentences. You are a setter, not a sales closer.
- Be warm, professional, and conversational — like a knowledgeable neighbor who happens to sell real estate.
- Never be pushy or aggressive. If someone is not interested, respect that immediately.
- Ask one question at a time. Do not stack multiple questions.
- Use natural language, not real estate jargon.

BOUNDARIES:
- Never guarantee property values, appreciation, or investment returns.
- Never pressure anyone into a decision.
- Never share other clients' personal information.
- Never make promises about mortgage approval or rates.
- If someone asks if you are AI: Yes, I am David, Prestige Realty's AI assistant. I help connect interested buyers with our team and schedule property tours. How can I help you today?`;

const body = {
    name: 'David — Real Estate Setter',
    firstMessage: "Hi, this is David from Prestige Realty Group. I'm reaching out because you expressed interest in real estate in New Jersey. Is now a good time to chat for a minute?",
    voicemailMessage: "Hi, this is David from Prestige Realty Group. I was calling about some properties you might be interested in. Feel free to call us back anytime, or visit our website. Thanks!",
    endCallMessage: "Thanks so much for your time. We'll be in touch soon. Have a great day!",
    endCallPhrases: ['goodbye', 'talk to you soon', "that's all", 'thanks bye', 'have a good day', 'take care', 'bye bye', 'not interested'],
    voice: {
        provider: 'cartesia',
        voiceId: '820a3788-2b37-4d21-847a-b65d8a68c99a',
        model: 'sonic-3',
    },
    model: {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        temperature: 0.4,
        maxTokens: 300,
        messages: [{ role: 'system', content: systemPrompt }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'lookup_property',
                    description: 'Look up property details from the MLS database by property ID or address. Call this when discussing a specific property.',
                    parameters: {
                        type: 'object',
                        required: [],
                        properties: {
                            propertyId: { type: 'string', description: 'MLS property ID (e.g., MLS-2024-001)' },
                            address: { type: 'string', description: 'Property address or partial address to search for' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'qualify_buyer',
                    description: 'Save buyer qualification data after gathering their requirements through conversation.',
                    parameters: {
                        type: 'object',
                        required: ['buyer_name'],
                        properties: {
                            buyer_name: { type: 'string', description: 'Full name of the buyer' },
                            budget_range: { type: 'string', description: "Budget range (e.g., '$500K-$700K')" },
                            timeline: { type: 'string', description: "Purchase timeline (e.g., 'next 3 months')" },
                            pre_approved: { type: 'string', description: 'Mortgage pre-approval status' },
                            preferred_areas: { type: 'string', description: 'Preferred towns or areas in NJ' },
                            beds_baths: { type: 'string', description: 'Bedroom and bathroom requirements' },
                            contact_info: { type: 'string', description: 'Phone number or email if provided' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'check_tour_availability',
                    description: 'Check available time slots for scheduling a property tour.',
                    parameters: {
                        type: 'object',
                        required: [],
                        properties: {
                            timezone: { type: 'string', description: 'Caller timezone, default America/New_York' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'book_tour',
                    description: 'Book a property tour on the calendar. Requires buyer name, email, date/time, and property details.',
                    parameters: {
                        type: 'object',
                        required: ['buyer_name', 'buyer_email', 'date_time'],
                        properties: {
                            buyer_name: { type: 'string', description: 'Full name of the buyer' },
                            buyer_email: { type: 'string', description: 'Email for the tour confirmation' },
                            date_time: { type: 'string', description: 'Selected date and time in ISO 8601 format' },
                            property_address: { type: 'string', description: 'Address of the property to tour' },
                            notes: { type: 'string', description: 'Additional notes about the tour or buyer preferences' },
                        },
                    },
                },
            },
        ],
    },
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
    serverUrl: WEBHOOK_URL,
    server: {
        url: WEBHOOK_URL,
        timeoutSeconds: 20,
    },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundDenoisingEnabled: true,
    metadata: {
        vertical: 'real-estate',
        demo: true,
        version: '1.0',
        callDirection: 'outbound',
    },
};

(async () => {
    console.log('Creating David — Real Estate Setter assistant...\n');

    const res = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
        console.error('FAILED:', JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log(`Created! Assistant ID: ${data.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Voice: ${data.voice?.provider} ${data.voice?.voiceId}`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`VAPI_ASSISTANT_ID_REALESTATE=${data.id}`);
    console.log(`${'='.repeat(60)}`);
    console.log('\nAdd this env var to Render and your .env to activate the real estate demo.');
})();
