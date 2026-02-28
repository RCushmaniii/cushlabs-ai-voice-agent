# Med Spa AI Front Desk — Demo Build Checklist

## Demo Identity
- **Fictitious Clinic Name:** Radiance Medical Spa
- **Agent Name:** Sophia
- **Location:** Scottsdale, AZ (high-density med spa market — great for demos)
- **Tagline:** "Your beauty goals, expertly guided."

---

## Demo Page Design (Based on your NYE template)

### Layout — replicate your New York English page structure:

```
[Brand Name — gold accent]
RADIANCE MEDICAL SPA

[Headline — white, serif]
AI Front Desk

[Subheadline — gold, italic]
Never miss a client. Never miss a booking.

[Service Tags — bordered pills]
BOTOX & DYSPORT | DERMAL FILLERS | LASER TREATMENTS | BODY CONTOURING | SKIN REJUVENATION

[CTA text — light gray]
Speak with Sophia, our AI scheduling assistant, to learn about
our services and book your complimentary consultation.

[Microphone Button — gold ring, same as NYE]
🎙️

[Status text — gold]
Call ended — click to speak again

[Footer — gold + gray]
Powered by CushLabs AI  |  Scottsdale, AZ
```

### Design Notes:
- Keep the same dark background + gold accent theme — it reads as premium
- Swap the NYE service pills for med spa services
- Same Vapi web widget integration you're already using
- Consider adding a subtle hero image or gradient behind the headline (optional)

---

## What To Build (Priority Order)

### Must-Have for Demo (Week 1)
- [ ] System prompt loaded into Vapi assistant
- [ ] Cartesia voice selected and tested (warm female voice)
- [ ] First message plays on connect
- [ ] Agent can handle: service inquiry, qualification Qs, objection handling
- [ ] Agent can "book" appointment (even if just verbal confirmation for demo)
- [ ] Demo page live on Render (replicate NYE template)
- [ ] 3-5 test calls recorded — verify latency, tone, flow

### Nice-to-Have for Demo (Week 2)
- [ ] Cal.com integration — agent actually creates calendar event
- [ ] Twilio SMS confirmation after booking
- [ ] Google Sheets webhook — captured leads log automatically
- [ ] After-hours behavior tested

### For First Paying Client (Week 3-4)
- [ ] Custom system prompt with their real clinic name, services, pricing
- [ ] Their real calendar connected
- [ ] Their real phone number forwarding to Vapi
- [ ] Call recording + transcription enabled for QA
- [ ] Weekly report template (calls handled, appointments booked, missed calls)

---

## Demo Script — Walk-Through for Prospects

When showing this to a med spa owner, here's how to demo it:

### Pre-Demo Setup:
- Have the demo page open on your screen or send them the link
- "I want to show you something. Pretend you're a potential client calling your clinic."

### Live Demo (you or the prospect calls in):

**Scenario 1: New client inquiry (Botox)**
Caller: "Hi, I'm interested in getting Botox."
→ Sophia qualifies, provides info, books consultation

**Scenario 2: Price shopper**
Caller: "How much is lip filler?"
→ Sophia gives range, pivots to consultation booking

**Scenario 3: Hesitant caller**
Caller: "I'm just looking around, not sure yet."
→ Sophia is warm, non-pushy, offers to send info + pencil in appointment

**Scenario 4: After hours**
Caller: "Are you guys open?"
→ Sophia explains office is closed, still captures lead and offers booking

### Post-Demo Pitch:
"That call would've gone to voicemail at 90% of med spas. That's a $2,000+ client who just walked away. Sophia makes sure that never happens — 24/7, no sick days, no hold times."

---

## Key Metrics to Track (Even During Demo Phase)

- Total calls handled
- Average call duration
- Appointments booked vs. calls received (conversion rate)
- Calls during business hours vs. after hours
- Top 3 services asked about
- Objections encountered (pricing, thinking about it, want human)

Even if you're just logging these in a Google Sheet manually during demos,
having data makes your sales pitch 10x stronger.

---

## Pitfalls & Things That Will Trip You Up

1. **Long agent responses kill the experience.** If Sophia talks for more than
   10-15 seconds straight, callers zone out or interrupt. Keep maxTokens low
   (200-250) and instruct the prompt to be concise.

2. **The "qualification checklist" trap.** If the agent asks all 6 questions
   rapid-fire, it feels like an interrogation. The system prompt says to weave
   them into conversation — test this. If it's not flowing naturally, reduce
   to 3-4 questions.

3. **Pricing conversations are dangerous.** If the agent gives a specific price
   and the real clinic charges differently, you've created a customer service
   problem. Always use ranges and defer to consultation.

4. **Latency spikes during demos will kill the sale.** Test your demo at
   different times of day. If you see >2 second response times, check your
   Render deployment region, Cartesia plan, and Vapi pipeline.

5. **Don't let the demo go off-script.** Prospects will try to break it by
   asking weird questions ("Can you prescribe me medication?" or "What's
   your address?"). Make sure your system prompt has guardrails for
   out-of-scope questions.

6. **Phone number vs. web widget.** For demos, the web widget is fine. For
   real clients, they need a real phone number (Twilio) that forwards.
   Don't promise phone integration until you've tested it end-to-end.
