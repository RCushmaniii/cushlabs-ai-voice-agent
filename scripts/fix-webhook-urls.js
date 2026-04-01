#!/usr/bin/env node
/**
 * Fix webhook URLs for ALL Vapi assistants.
 * Patches every assistant in the account to use the production webhook.
 *
 * Run: node scripts/fix-webhook-urls.js
 * Requires: VAPI_API_PRIVATE_KEY in .env
 */

require('dotenv').config();

const KEY = process.env.VAPI_API_PRIVATE_KEY;
if (!KEY) {
    console.error('Missing VAPI_API_PRIVATE_KEY in .env');
    process.exit(1);
}

const WEBHOOK_URL = 'https://voice.cushlabs.ai/api/webhook';

async function listAssistants() {
    const res = await fetch('https://api.vapi.ai/assistant', {
        headers: { 'Authorization': `Bearer ${KEY}` },
    });
    if (!res.ok) {
        console.error('Failed to list assistants:', await res.text());
        process.exit(1);
    }
    return res.json();
}

async function patchWebhook(id, name, currentUrl) {
    const res = await fetch(`https://api.vapi.ai/assistant/${id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            server: {
                url: WEBHOOK_URL,
                timeoutSeconds: 20,
            },
        }),
    });
    const data = await res.json();
    if (!res.ok) {
        console.error(`  FAIL: ${name} (${id})`, JSON.stringify(data, null, 2));
        return false;
    }
    console.log(`  OK: ${name} — ${currentUrl || '(none)'} → ${WEBHOOK_URL}`);
    return true;
}

(async () => {
    console.log('Fetching all Vapi assistants...\n');
    const assistants = await listAssistants();
    console.log(`Found ${assistants.length} assistant(s):\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const a of assistants) {
        const currentUrl = a.server?.url || '(no webhook set)';
        const name = a.name || '(unnamed)';

        if (currentUrl === WEBHOOK_URL) {
            console.log(`  SKIP: ${name} — already correct`);
            skipped++;
            continue;
        }

        const ok = await patchWebhook(a.id, name, currentUrl);
        if (ok) updated++;
        else failed++;
    }

    console.log(`\nDone: ${updated} updated, ${skipped} already correct, ${failed} failed`);
})();
