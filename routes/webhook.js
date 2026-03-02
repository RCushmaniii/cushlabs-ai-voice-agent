const express = require('express');
const path = require('path');
const { storeLeadData, getLeadData, deleteLeadData } = require('../services/redis');
const { getAvailableSlots, bookAppointment } = require('../services/calendar');
const { saveLead, saveBooking, updateLeadWithCallData } = require('../services/db');

// Load mock MLS data
const mockMLS = require(path.join(__dirname, '..', 'data', 'mock-mls.json'));

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.type) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        console.log(`[Vapi Webhook] Event: ${message.type}`);

        switch (message.type) {
            case 'function-call':
                return handleFunctionCall(message, res);

            case 'end-of-call-report':
                return handleEndOfCallReport(message, res);

            case 'status-update':
                console.log(`[Vapi] Call status: ${message.status}`);
                return res.status(200).send('Status update received');

            case 'transcript':
                console.log(`[Vapi] Transcript update: ${message.role}: ${message.transcript}`);
                return res.status(200).send('Transcript received');

            default:
                console.log(`[Vapi] Unhandled event type: ${message.type}`);
                return res.status(200).send('Event received');
        }
    } catch (error) {
        console.error('[Vapi Webhook] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function handleFunctionCall(message, res) {
    const { functionCall } = message;

    if (!functionCall) {
        return res.status(400).json({ error: 'Missing functionCall in message' });
    }

    const callId = message.call?.id || 'unknown';
    console.log(`[Vapi] Function call: ${functionCall.name}`, functionCall.parameters);

    switch (functionCall.name) {
        case 'check_availability':
            return handleCheckAvailability(functionCall, res);

        case 'book_appointment':
            return handleBookAppointment(functionCall, callId, res);

        case 'qualify_lead':
            return handleQualifyLead(functionCall, callId, res);

        case 'save_lead':
            return handleSaveLead(functionCall, callId, res);

        case 'lookup_property':
            return handleLookupProperty(functionCall, res);

        case 'qualify_buyer':
            return handleQualifyBuyer(functionCall, callId, res);

        case 'check_tour_availability':
            return handleCheckTourAvailability(functionCall, res);

        case 'book_tour':
            return handleBookTour(functionCall, callId, res);

        default:
            console.log(`[Vapi] Unknown function: ${functionCall.name}`);
            return res.status(200).json({
                results: [{
                    toolCallId: functionCall.id,
                    result: "Function acknowledged."
                }]
            });
    }
}

// --- Check Availability ---
async function handleCheckAvailability(functionCall, res) {
    const timezone = functionCall.parameters?.timezone || 'America/New_York';

    try {
        const slots = await getAvailableSlots(timezone);
        const formatted = slots.map(s =>
            `${s.dayLabel}: ${s.times.join(', ')}`
        ).join('. ');

        console.log('[Calendar] Returning availability:', formatted);

        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: `Here are the available slots for a 30-minute discovery session: ${formatted}. Ask the caller which slot works best for them.`
            }]
        });
    } catch (err) {
        console.error('[Calendar] Error checking availability:', err.message);
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I am having trouble checking the calendar right now. Ask the caller for their preferred day and time, and let them know we will confirm by email."
            }]
        });
    }
}

// --- Book Appointment ---
async function handleBookAppointment(functionCall, callId, res) {
    const { caller_name, caller_email, date_time, notes } = functionCall.parameters || {};

    if (!caller_name || !caller_email || !date_time) {
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I need the caller's full name, email address, and preferred date and time to book. Please ask for any missing details."
            }]
        });
    }

    try {
        const result = await bookAppointment({ caller_name, caller_email, date_time, notes });
        console.log('[Calendar] Appointment booked:', result);

        // Store in Redis (session) and Neon (permanent)
        try {
            await storeLeadData(callId, { caller_name, caller_email, date_time, notes: notes || '', call_id: callId });
        } catch (redisErr) {
            console.error('[Redis] Failed to store booking lead:', redisErr.message);
        }
        try {
            await saveBooking({ call_id: callId, caller_name, caller_email, date_time, notes });
        } catch (dbErr) {
            console.error('[DB] Failed to save booking:', dbErr.message);
        }

        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: `The discovery session is booked for ${result.friendlyTime}. A calendar invite has been sent to ${caller_email}. Let the caller know they are all set and to check their email for the invite.`
            }]
        });
    } catch (err) {
        console.error('[Calendar] Error booking appointment:', err.message);
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I was unable to book that time slot. It may have just been taken. Ask the caller if they would like to try a different time."
            }]
        });
    }
}

// --- Qualify Lead (CushLabs) ---
async function handleQualifyLead(functionCall, callId, res) {
    const { user_name, business_type, ai_interest } = functionCall.parameters || {};

    const leadData = {
        user_name: user_name || 'Not provided',
        business_type: business_type || 'Not provided',
        ai_interest: ai_interest || 'Not provided',
        qualified_at: new Date().toISOString(),
        call_id: callId,
    };

    try {
        await storeLeadData(callId, leadData);
        console.log('[Vapi] Lead qualified:', leadData);
    } catch (redisError) {
        console.error('[Redis] Failed to store lead:', redisError.message);
    }
    try {
        await saveLead({ call_id: callId, caller_name: user_name, business_type, interest: ai_interest, source: 'cushlabs' });
    } catch (dbErr) {
        console.error('[DB] Failed to save lead:', dbErr.message);
    }

    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: "Lead data saved successfully. Thank the user and let them know someone from CushLabs will follow up shortly."
        }]
    });
}

// --- Save Lead (Coaching) ---
async function handleSaveLead(functionCall, callId, res) {
    const { caller_name, interest, contact_info } = functionCall.parameters || {};

    const leadData = {
        caller_name: caller_name || 'Not provided',
        interest: interest || 'Not provided',
        contact_info: contact_info || 'Not provided',
        saved_at: new Date().toISOString(),
        call_id: callId,
    };

    try {
        await storeLeadData(callId, leadData);
        console.log('[Vapi] Lead saved:', leadData);
    } catch (redisError) {
        console.error('[Redis] Failed to store lead:', redisError.message);
    }
    try {
        await saveLead({ call_id: callId, caller_name, contact_info, interest, source: 'coaching' });
    } catch (dbErr) {
        console.error('[DB] Failed to save lead:', dbErr.message);
    }

    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: "Lead information saved. Thank the caller and let them know someone will reach out soon to help them get started."
        }]
    });
}

// --- Lookup Property (Real Estate) ---
async function handleLookupProperty(functionCall, res) {
    const { propertyId, address } = functionCall.parameters || {};

    let property = null;
    if (propertyId) {
        property = mockMLS.find(p => p.id === propertyId);
    }
    if (!property && address) {
        const query = address.toLowerCase();
        property = mockMLS.find(p => p.address.toLowerCase().includes(query));
    }

    if (!property) {
        console.log(`[MLS] Property not found: id=${propertyId}, address=${address}`);
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I could not find that property in our listings. Could you double-check the address or MLS ID? Or I can tell you about some great properties we currently have available."
            }]
        });
    }

    const formatted = `${property.address} — $${property.price.toLocaleString()}. ` +
        `${property.beds} bed, ${property.baths} bath, ${property.sqft.toLocaleString()} sqft ${property.propertyType}. ` +
        `Built in ${property.yearBuilt}, lot size ${property.lotSize}. ` +
        `${property.description} ` +
        `Key features: ${property.features.join(', ')}. ` +
        `Listed ${property.daysOnMarket} days ago. MLS ID: ${property.id}.`;

    console.log(`[MLS] Found property: ${property.id} — ${property.address}`);

    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: formatted
        }]
    });
}

// --- Qualify Buyer (Real Estate) ---
async function handleQualifyBuyer(functionCall, callId, res) {
    const { buyer_name, budget_range, timeline, pre_approved, preferred_areas, beds_baths, contact_info } = functionCall.parameters || {};

    const leadData = {
        buyer_name: buyer_name || 'Not provided',
        budget_range: budget_range || 'Not provided',
        timeline: timeline || 'Not provided',
        pre_approved: pre_approved || 'Not provided',
        preferred_areas: preferred_areas || 'Not provided',
        beds_baths: beds_baths || 'Not provided',
        contact_info: contact_info || 'Not provided',
        qualified_at: new Date().toISOString(),
        call_id: callId,
        source: 'realestate',
    };

    try {
        await storeLeadData(callId, leadData);
        console.log('[Vapi] Buyer qualified:', leadData);
    } catch (redisError) {
        console.error('[Redis] Failed to store buyer lead:', redisError.message);
    }
    try {
        await saveLead({
            call_id: callId,
            caller_name: buyer_name,
            business_type: `Real Estate — Budget: ${budget_range || 'N/A'}, Areas: ${preferred_areas || 'N/A'}`,
            interest: `Timeline: ${timeline || 'N/A'}, Pre-approved: ${pre_approved || 'N/A'}, Beds/Baths: ${beds_baths || 'N/A'}`,
            source: 'realestate',
        });
    } catch (dbErr) {
        console.error('[DB] Failed to save buyer lead:', dbErr.message);
    }

    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: "Buyer qualification data saved successfully. Continue the conversation naturally — if they are interested in seeing a property, offer to check tour availability."
        }]
    });
}

// --- Check Tour Availability (Real Estate) ---
async function handleCheckTourAvailability(functionCall, res) {
    const timezone = functionCall.parameters?.timezone || 'America/New_York';

    try {
        const slots = await getAvailableSlots(timezone);
        const formatted = slots.map(s =>
            `${s.dayLabel}: ${s.times.join(', ')}`
        ).join('. ');

        console.log('[Calendar] Returning tour availability:', formatted);

        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: `Here are the available slots for a property tour: ${formatted}. Suggest 2-3 convenient options and ask which works best for them.`
            }]
        });
    } catch (err) {
        console.error('[Calendar] Error checking tour availability:', err.message);
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I am having trouble checking the calendar right now. Ask for their preferred day and time, and let them know we will confirm by email."
            }]
        });
    }
}

// --- Book Tour (Real Estate) ---
async function handleBookTour(functionCall, callId, res) {
    const { buyer_name, buyer_email, date_time, property_address, notes } = functionCall.parameters || {};

    if (!buyer_name || !buyer_email || !date_time) {
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I need the buyer's full name, email address, and preferred date and time to book the tour. Please ask for any missing details."
            }]
        });
    }

    const tourNotes = `Property Tour${property_address ? ` — ${property_address}` : ''}${notes ? `. ${notes}` : ''}`;

    try {
        const result = await bookAppointment({
            caller_name: buyer_name,
            caller_email: buyer_email,
            date_time,
            notes: tourNotes,
        });
        console.log('[Calendar] Tour booked:', result);

        try {
            await storeLeadData(callId, { buyer_name, buyer_email, date_time, property_address, notes: tourNotes, call_id: callId });
        } catch (redisErr) {
            console.error('[Redis] Failed to store tour booking:', redisErr.message);
        }
        try {
            await saveBooking({ call_id: callId, caller_name: buyer_name, caller_email: buyer_email, date_time, notes: tourNotes });
        } catch (dbErr) {
            console.error('[DB] Failed to save tour booking:', dbErr.message);
        }

        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: `The property tour is booked for ${result.friendlyTime}. A calendar invite has been sent to ${buyer_email}. Let them know they are all set and to check their email for the details.`
            }]
        });
    } catch (err) {
        console.error('[Calendar] Error booking tour:', err.message);
        return res.status(200).json({
            results: [{
                toolCallId: functionCall.id,
                result: "I was unable to book that time slot. It may have just been taken. Ask if they would like to try a different time."
            }]
        });
    }
}

// --- End of Call Report ---
async function handleEndOfCallReport(message, res) {
    const callId = message.call?.id || 'unknown';
    const transcript = message.transcript || 'No transcript available';
    const summary = message.summary || '';
    const duration = message.endedReason || 'unknown';

    console.log(`[Vapi] Call ended (${callId}). Reason: ${duration}`);
    console.log(`[Vapi] Transcript:\n${transcript}`);

    if (summary) {
        console.log(`[Vapi] Summary: ${summary}`);
    }

    try {
        const leadData = await getLeadData(callId);
        if (leadData) {
            console.log(`[Vapi] Final lead data for call ${callId}:`, {
                ...leadData,
                transcript,
                summary,
                ended_reason: duration,
            });
            try {
                await updateLeadWithCallData(callId, { transcript, summary, ended_reason: duration });
            } catch (dbErr) {
                console.error('[DB] Failed to update lead with call data:', dbErr.message);
            }
            await deleteLeadData(callId);
        }
    } catch (redisError) {
        console.error('[Redis] Failed to retrieve/clear lead data:', redisError.message);
    }

    return res.status(200).send('Report received');
}

module.exports = router;
