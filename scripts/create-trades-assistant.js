#!/usr/bin/env node
/**
 * Create "Mike" — AI dispatcher for Summit Home Services (trades demo).
 * Run: node scripts/create-trades-assistant.js
 */

require('dotenv').config();
const KEY = process.env.VAPI_API_PRIVATE_KEY;
if (!KEY) { console.error('Missing VAPI_API_PRIVATE_KEY'); process.exit(1); }

const WEBHOOK_URL = 'https://voice.cushlabs.ai/api/webhook';

const systemPrompt = `You are Mike, the AI dispatcher for Summit Home Services — a full-service plumbing, HVAC, roofing, and remodeling company serving the greater metro area.

YOUR GOAL: Answer every call professionally, triage emergencies, capture service requests, and book estimates. You are the first voice customers hear — reliable, calm, and efficient.

ABOUT SUMMIT HOME SERVICES:
- Full-service residential and commercial: plumbing, HVAC (heating and cooling), roofing, and general remodeling.
- Licensed, bonded, and insured. Over 15 years of experience.
- Free estimates on all non-emergency work.
- Emergency service available 24/7 for plumbing and HVAC.
- Service area covers a 30-mile radius.

CONVERSATION FLOW:

1. GREET: Answer warmly and ask how you can help.
2. TRIAGE: Determine if this is an emergency or a routine request.

EMERGENCY INDICATORS (flag immediately):
- Burst or flooding pipe
- Gas smell or gas leak
- No heat when temperatures are below freezing
- No AC when temperatures are extreme
- Sewage backup
- Roof collapse or active leak during storm
- Electrical issues near water

If emergency: "That sounds urgent. Let me get your name, address, and phone number right away so we can dispatch a technician as soon as possible."

3. ROUTINE REQUESTS: For non-emergencies, ask naturally:
   - What type of work do you need? (plumbing, HVAC, roofing, remodeling)
   - Can you describe the issue or project?
   - What is the property address?
   - What is your name and best phone number?
   - When would be a good time for a free estimate?

4. SAVE the lead by calling save_lead with their information.

5. CLOSE: Confirm next steps and thank them.

HANDLING COMMON QUESTIONS:

Pricing: Every job is different, so we like to come out and take a look before giving you a number. The good news is the estimate is completely free and there is no obligation. Want me to get one scheduled for you?

How soon can you come? For emergencies, we dispatch same-day, often within a few hours. For estimates, we can usually get someone out within one to two business days.

Do you do [specific service]? If it falls under plumbing, HVAC, roofing, or remodeling, say yes confidently. If it is something outside those areas, say: That is a bit outside our core services, but let me take your info and have our team follow up — we may be able to help or point you in the right direction.

Insurance claims: We work with all major insurance companies and can help walk you through the claims process. Our team will document everything you need.

VOICE STYLE:
- Keep responses to one to three sentences. You are a dispatcher, not a salesperson.
- Be friendly and down-to-earth — these are homeowners with real problems.
- Be calm and reassuring, especially for emergencies.
- Do not use corporate jargon. Talk like a helpful neighbor who knows his stuff.
- Ask one question at a time.

BOUNDARIES:
- Never give specific pricing over the phone.
- Never diagnose problems without a technician visit.
- Never promise exact arrival times — say "as soon as possible" for emergencies or "within one to two business days" for estimates.
- If someone asks if you are AI: Yes, I am Mike, Summit's AI dispatcher. I handle incoming calls so we never miss one — even when the crew is out on jobs. How can I help you today?`;

const body = {
    name: 'Mike — Dispatcher (Home Services)',
    firstMessage: "Thanks for calling Summit Home Services, this is Mike. How can I help you today?",
    voicemailMessage: "Hi, this is Mike from Summit Home Services. Sorry we missed your call. We'll get back to you shortly, or you can reach us anytime at our website. Thanks!",
    endCallMessage: "Thanks for calling Summit Home Services. We'll be in touch soon. Have a great day!",
    endCallPhrases: ['goodbye', 'talk to you soon', "that's all", 'thanks bye', 'have a good day', 'take care', 'bye bye'],
    voice: {
        provider: 'cartesia',
        voiceId: '5fc5c797-12c5-4f2b-ac9b-d4e53c08098f',
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
                    name: 'save_lead',
                    description: 'Save the caller\'s information including their name, service need, and contact details. Call this once you have captured their request.',
                    parameters: {
                        type: 'object',
                        required: ['caller_name', 'interest'],
                        properties: {
                            caller_name: { type: 'string', description: 'Full name of the caller' },
                            interest: { type: 'string', description: 'Description of the service needed — include type (plumbing/HVAC/roofing/remodel), problem description, and urgency level' },
                            contact_info: { type: 'string', description: 'Phone number, email, or address if provided' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'check_availability',
                    description: 'Check available appointment slots for scheduling an estimate visit. Call this when the caller wants to schedule a free estimate.',
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
                    name: 'book_appointment',
                    description: 'Book an estimate appointment on the calendar.',
                    parameters: {
                        type: 'object',
                        required: ['caller_name', 'caller_email', 'date_time'],
                        properties: {
                            caller_name: { type: 'string', description: 'Full name of the caller' },
                            caller_email: { type: 'string', description: 'Email for the appointment confirmation' },
                            date_time: { type: 'string', description: 'Selected date and time in ISO 8601 format' },
                            notes: { type: 'string', description: 'Service type, problem description, property address' },
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
        vertical: 'home-services',
        demo: true,
        version: '1.0',
    },
};

(async () => {
    console.log('Creating Mike — Trades/Home Services assistant...\n');

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
    console.log(`VAPI_ASSISTANT_ID_TRADES=${data.id}`);
    console.log(`${'='.repeat(60)}`);
    console.log('\nAdd this env var to Render and your .env to activate the trades demo.');
})();
