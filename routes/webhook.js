const express = require('express');
const { storeLeadData, getLeadData, deleteLeadData } = require('../services/redis');
const { getAvailableSlots, bookAppointment } = require('../services/calendar');

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

        // Also store as lead data
        try {
            await storeLeadData(callId, {
                caller_name,
                caller_email,
                date_time,
                notes: notes || '',
                booked_at: new Date().toISOString(),
                call_id: callId,
            });
        } catch (redisErr) {
            console.error('[Redis] Failed to store booking lead:', redisErr.message);
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

    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: "Lead information saved. Thank the caller and let them know someone will reach out soon to help them get started."
        }]
    });
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
            // TODO: Push to Neon Postgres for permanent storage
            await deleteLeadData(callId);
        }
    } catch (redisError) {
        console.error('[Redis] Failed to retrieve/clear lead data:', redisError.message);
    }

    return res.status(200).send('Report received');
}

module.exports = router;
