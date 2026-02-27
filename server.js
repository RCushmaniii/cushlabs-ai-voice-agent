require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const webhookRouter = require('./routes/webhook');
const { initDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'cushlabs-ai-voice-agent' });
});

// Serve public Vapi config to frontend (only public key + assistant ID, never private key)
const assistants = {
    cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
    coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
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

// Serve Portfolio page
app.get('/portfolio', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'portfolio.html'));
});

// Vapi webhook endpoint
app.use('/api/webhook', webhookRouter);

app.listen(PORT, async () => {
    console.log(`CushLabs AI Voice Agent backend running on port ${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/api/webhook`);
    console.log(`Frontend: http://localhost:${PORT}`);
    await initDb();
});
