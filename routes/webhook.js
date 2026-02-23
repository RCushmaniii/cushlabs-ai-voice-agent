const express = require('express');
const { storeLeadData, getLeadData, deleteLeadData } = require('../services/redis');

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

    console.log(`[Vapi] Function call: ${functionCall.name}`, functionCall.parameters);

    if (functionCall.name === 'qualify_lead') {
        const { user_name, business_type, ai_interest } = functionCall.parameters || {};
        const callId = message.call?.id || 'unknown';

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

            return res.status(200).json({
                results: [{
                    toolCallId: functionCall.id,
                    result: "Lead data saved successfully. Thank the user and let them know someone from CushLabs will follow up shortly."
                }]
            });
        } catch (redisError) {
            console.error('[Redis] Failed to store lead:', redisError.message);
            // Still acknowledge to Vapi even if Redis fails — don't break the call
            return res.status(200).json({
                results: [{
                    toolCallId: functionCall.id,
                    result: "Lead information noted. Thank the user and let them know someone from CushLabs will follow up shortly."
                }]
            });
        }
    }

    // Unknown function — acknowledge gracefully
    return res.status(200).json({
        results: [{
            toolCallId: functionCall.id,
            result: "Function acknowledged."
        }]
    });
}

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

    // Retrieve any lead data stored during the call
    try {
        const leadData = await getLeadData(callId);
        if (leadData) {
            console.log(`[Vapi] Final lead data for call ${callId}:`, {
                ...leadData,
                transcript,
                summary,
                ended_reason: duration,
            });
            // TODO: Push to CRM, database, or external webhook here
            await deleteLeadData(callId);
        }
    } catch (redisError) {
        console.error('[Redis] Failed to retrieve/clear lead data:', redisError.message);
    }

    return res.status(200).send('Report received');
}

module.exports = router;
