#!/usr/bin/env node
/**
 * PATCH the existing David — Real Estate Setter assistant on Vapi to attach
 * (or replace) the 4 function tools required by the outbound flow.
 *
 * Run: node scripts/update-realestate-tools.js
 *
 * Reads VAPI_API_PRIVATE_KEY and VAPI_ASSISTANT_ID_REALESTATE from .env.
 * GETs the current assistant, merges in the tools array, PATCHes it back.
 */

require('dotenv').config();

const KEY = process.env.VAPI_API_PRIVATE_KEY;
const ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID_REALESTATE;

if (!KEY) { console.error('Missing VAPI_API_PRIVATE_KEY'); process.exit(1); }
if (!ASSISTANT_ID) { console.error('Missing VAPI_ASSISTANT_ID_REALESTATE'); process.exit(1); }

const tools = [
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
];

(async () => {
    const headers = {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
    };

    console.log(`Fetching assistant ${ASSISTANT_ID}...`);
    const getRes = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, { headers });
    if (!getRes.ok) {
        console.error(`GET failed: ${getRes.status}`);
        console.error(await getRes.text());
        process.exit(1);
    }
    const current = await getRes.json();
    console.log(`Found: ${current.name}`);
    console.log(`Current tool count: ${(current.model?.tools || []).length}`);

    const newModel = { ...current.model, tools };

    console.log(`Patching assistant with ${tools.length} tools...`);
    const patchRes = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ model: newModel }),
    });

    const data = await patchRes.json();

    if (!patchRes.ok) {
        console.error(`PATCH failed: ${patchRes.status}`);
        console.error(JSON.stringify(data, null, 2));
        process.exit(1);
    }

    const finalToolCount = (data.model?.tools || []).length;
    console.log(`\nUpdated: ${data.name}`);
    console.log(`New tool count: ${finalToolCount}`);
    console.log(`Tools: ${(data.model?.tools || []).map(t => t.function?.name).join(', ')}`);

    if (finalToolCount !== tools.length) {
        console.error(`\nWARNING: expected ${tools.length} tools, got ${finalToolCount}`);
        process.exit(1);
    }

    console.log('\nDone.');
})();
