const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('Environment validation', () => {
    let originalEnv;
    let exitMock;

    beforeEach(() => {
        originalEnv = { ...process.env };
        // Set all required vars
        process.env.VAPI_API_PUBLIC_KEY = 'test';
        process.env.VAPI_API_PRIVATE_KEY = 'test';
        process.env.VAPI_ASSISTANT_ID_CUSHLABS = 'test';
        process.env.DATABASE_URL = 'test';
        process.env.REDIS_URL = 'test';
        process.env.SENTRY_DSN = 'test';
        process.env.GOOGLE_CLIENT_ID = 'test';
        process.env.GOOGLE_CLIENT_SECRET = 'test';
        process.env.GOOGLE_REFRESH_TOKEN = 'test';
        process.env.CALENDAR_ID = 'test';
        process.env.VAPI_WEBHOOK_SECRET = 'test';

        // Mock process.exit so tests don't actually exit
        exitMock = mock.method(process, 'exit', () => {
            throw new Error('process.exit called');
        });
    });

    afterEach(() => {
        process.env = originalEnv;
        exitMock.mock.restore();
        // Clear module cache so validateEnv re-reads env
        delete require.cache[require.resolve('../services/env')];
    });

    it('passes when all required vars are set', () => {
        const { validateEnv } = require('../services/env');
        assert.doesNotThrow(() => validateEnv());
    });

    it('exits when a required var is missing', () => {
        delete process.env.DATABASE_URL;
        const { validateEnv } = require('../services/env');
        assert.throws(() => validateEnv(), /process\.exit called/);
        assert.equal(exitMock.mock.calls.length, 1);
        assert.equal(exitMock.mock.calls[0].arguments[0], 1);
    });

    it('warns but continues when recommended vars are missing', () => {
        delete process.env.SENTRY_DSN;
        delete process.env.GOOGLE_CLIENT_ID;
        const { validateEnv } = require('../services/env');
        assert.doesNotThrow(() => validateEnv());
    });
});
