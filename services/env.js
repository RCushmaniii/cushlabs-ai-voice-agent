/**
 * Startup environment validation.
 * Fails fast on missing critical env vars instead of crashing mid-request.
 */

const REQUIRED = [
    'VAPI_API_PUBLIC_KEY',
    'VAPI_API_PRIVATE_KEY',
    'VAPI_ASSISTANT_ID_CUSHLABS',
    'DATABASE_URL',
    'REDIS_URL',
];

const RECOMMENDED = [
    'SENTRY_DSN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'CALENDAR_ID',
    'VAPI_WEBHOOK_SECRET',
];

function validateEnv() {
    const missing = REQUIRED.filter(key => !process.env[key]);
    const missingRecommended = RECOMMENDED.filter(key => !process.env[key]);

    if (missingRecommended.length > 0) {
        console.warn(`[Env] Missing recommended vars: ${missingRecommended.join(', ')}`);
    }

    if (missing.length > 0) {
        console.error(`[Env] FATAL — missing required env vars: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log('[Env] All required environment variables present');
}

module.exports = { validateEnv };
