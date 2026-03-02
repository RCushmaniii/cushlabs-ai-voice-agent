require('dotenv').config();
const KEY = process.env.CARTESIA_API_KEY;
if (!KEY) { console.log('No CARTESIA_API_KEY in .env'); process.exit(0); }

(async () => {
    const res = await fetch('https://api.cartesia.ai/voices', {
        headers: { 'X-API-Key': KEY, 'Cartesia-Version': '2024-06-10' }
    });
    const voices = await res.json();
    // Find male English voices
    const candidates = voices.filter(v =>
        v.language === 'en' && v.description && /male|man|deep|friendly|warm/i.test(v.description)
    );
    candidates.forEach(v => console.log(v.id, '|', v.name, '|', (v.description || '').substring(0, 80)));
})();
