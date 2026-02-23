require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const webhookRouter = require('./routes/webhook');

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

// Vapi webhook endpoint
app.use('/api/webhook', webhookRouter);

app.listen(PORT, () => {
    console.log(`CushLabs AI Voice Agent backend running on port ${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/api/webhook`);
    console.log(`Frontend: http://localhost:${PORT}`);
});
