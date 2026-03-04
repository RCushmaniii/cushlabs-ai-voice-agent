require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const webhookRouter = require('./routes/webhook');
const { initDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Headers ---
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
    res.setHeader('X-XSS-Protection', '0'); // Disabled per modern best practice (CSP preferred)
    next();
});

// --- Gzip Compression ---
app.use(compression());

// CORS — restrict to production domain + local dev
const allowedOrigins = [
    'https://voice.cushlabs.ai',
    'http://localhost:3000',
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server requests (no origin, e.g. Vapi webhooks) + allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    }
}));

// Body parser with size limit (100KB — webhooks can include transcripts)
app.use(express.json({ limit: '100kb' }));

// Serve static frontend files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',            // HTML/CSS/JS: 1 day cache
    etag: true,
    setHeaders: (res, filePath) => {
        // Images and fonts: 1 year immutable cache
        if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));

// Health check endpoints — /healthz for Render's health check path, /api/health for internal use
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'cushlabs-ai-voice-agent' });
});

// Serve public Vapi config to frontend (only public key + assistant ID, never private key)
const assistants = {
    cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
    coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
    medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA,
    trades: process.env.VAPI_ASSISTANT_ID_TRADES,
    realestate: process.env.VAPI_ASSISTANT_ID_REALESTATE,
};

app.get('/api/config', (req, res) => {
    const service = req.query.service || 'cushlabs';
    const assistantId = assistants[service] || assistants.cushlabs;
    res.json({
        publicKey: process.env.VAPI_API_PUBLIC_KEY,
        assistantId,
    });
});

// Serve NYC Coaching page
app.get('/nyc-coaching', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nyc-coaching.html'));
});

// Serve Med Spa demo page
app.get('/medspa', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'medspa.html'));
});

// Serve Portfolio page
app.get('/portfolio', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'portfolio.html'));
});

// Serve Contact page
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Serve Consultation / Book a Call page
app.get('/consultation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultation.html'));
});

// Serve Trades demo page
app.get('/trades', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trades.html'));
});

// Serve Real Estate demo page
app.get('/realestate', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'realestate.html'));
});

// --- Simple rate limiter factory ---
function createRateLimiter(windowMs, maxPerWindow) {
    const hits = new Map();
    // Periodic cleanup every 60s to prevent memory leak
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, timestamps] of hits) {
            const filtered = timestamps.filter(t => t > cutoff);
            if (filtered.length === 0) hits.delete(key);
            else hits.set(key, filtered);
        }
    }, 60000).unref();

    return (req, res, next) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        const cutoff = now - windowMs;
        const timestamps = (hits.get(ip) || []).filter(t => t > cutoff);
        if (timestamps.length >= maxPerWindow) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        timestamps.push(now);
        hits.set(ip, timestamps);
        next();
    };
}

// Rate limit: 5 contact form submissions per 15 min per IP
const contactLimiter = createRateLimiter(15 * 60 * 1000, 5);

// Contact form endpoint
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/contact', contactLimiter, async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }
    // Truncate inputs to reasonable lengths
    const safeName = String(name).slice(0, 200);
    const safeEmail = String(email).slice(0, 254);
    const safePhone = phone ? String(phone).slice(0, 30) : null;
    const safeMessage = String(message).slice(0, 5000);

    try {
        if (process.env.DATABASE_URL) {
            const { neon } = require('@neondatabase/serverless');
            const sql = neon(process.env.DATABASE_URL);
            await sql`
                INSERT INTO contact_messages (name, email, phone, message)
                VALUES (${safeName}, ${safeEmail}, ${safePhone}, ${safeMessage})
            `;
        }
        console.log(`[Contact] Message from ${safeName} <${safeEmail}>: ${safeMessage.substring(0, 100)}`);
        res.json({ ok: true });
    } catch (err) {
        console.error('[Contact] Failed to save message:', err.message);
        res.json({ ok: true }); // Still return success — message is logged
    }
});

// --- Outbound Call Endpoint (Real Estate) ---
// Rate limit: 1 call per 30s per IP
const outboundLimiter = createRateLimiter(30000, 1);

app.post('/api/outbound-call', outboundLimiter, async (req, res) => {
    const { phoneNumber, propertyId } = req.body;

    // Validate env vars
    const vapiKey = process.env.VAPI_API_PRIVATE_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const assistantId = process.env.VAPI_ASSISTANT_ID_REALESTATE;

    if (!vapiKey || !phoneNumberId || !assistantId) {
        return res.status(503).json({
            error: 'Outbound calling is not configured. Missing VAPI_API_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID, or VAPI_ASSISTANT_ID_REALESTATE.'
        });
    }

    // Validate phone number (E.164 US format)
    if (!phoneNumber || !/^\+1\d{10}$/.test(phoneNumber)) {
        return res.status(400).json({
            error: 'Invalid phone number. Must be US E.164 format: +1XXXXXXXXXX'
        });
    }

    try {
        const callBody = {
            phoneNumberId,
            assistantId,
            customer: { number: phoneNumber },
            metadata: { source: 'realestate-demo', propertyId: propertyId || null },
        };

        console.log(`[Outbound] Initiating call to ${phoneNumber}`, { propertyId });

        const vapiRes = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vapiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(callBody),
        });

        const data = await vapiRes.json();

        if (!vapiRes.ok) {
            console.error('[Outbound] Vapi API error:', JSON.stringify(data));
            return res.status(vapiRes.status >= 500 ? 502 : 400).json({
                error: data.message || 'Failed to initiate outbound call.',
            });
        }

        console.log(`[Outbound] Call initiated: ${data.id} → ${phoneNumber}`);
        return res.json({ callId: data.id, status: data.status || 'queued' });

    } catch (err) {
        console.error('[Outbound] Error:', err.message);
        return res.status(500).json({ error: 'Internal server error initiating call.' });
    }
});

// Vapi webhook endpoint
app.use('/api/webhook', webhookRouter);

app.listen(PORT, async () => {
    console.log(`CushLabs AI Voice Agent backend running on port ${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/api/webhook`);
    console.log(`Frontend: http://localhost:${PORT}`);
    await initDb();

    // Keep Render free tier warm — self-ping every 14 minutes
    const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(() => {
        fetch(`${KEEP_ALIVE_URL}/api/health`)
            .then(() => console.log('[keep-alive] ping sent'))
            .catch(() => {});
    }, 14 * 60 * 1000);
});
