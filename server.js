require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const webhookRouter = require('./routes/webhook');
const { initDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

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

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    try {
        if (process.env.DATABASE_URL) {
            const { neon } = require('@neondatabase/serverless');
            const sql = neon(process.env.DATABASE_URL);
            await sql`
                CREATE TABLE IF NOT EXISTS contact_messages (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT,
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `;
            await sql`
                INSERT INTO contact_messages (name, email, phone, message)
                VALUES (${name}, ${email}, ${phone || null}, ${message})
            `;
        }
        console.log(`[Contact] Message from ${name} <${email}>: ${message.substring(0, 100)}`);
        res.json({ ok: true });
    } catch (err) {
        console.error('[Contact] Failed to save message:', err.message);
        res.json({ ok: true }); // Still return success — message is logged
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
