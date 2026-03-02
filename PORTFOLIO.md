---
# =============================================================================
# PORTFOLIO.md — CushLabs AI Voice Agent
# =============================================================================
portfolio_enabled: true
portfolio_priority: 1
portfolio_featured: true
portfolio_last_reviewed: "2026-03-02"

title: "AI Voice Agent Platform"
tagline: "Production voice AI agents that qualify leads, book appointments, and handle support calls 24/7"
slug: "cushlabs-voice-agent"
category: "AI Automation"
tech_stack:
  - "Vapi"
  - "Claude Sonnet"
  - "Groq Llama 3.1"
  - "Deepgram Nova-2/3"
  - "Cartesia"
  - "Twilio"
  - "Express.js"
  - "Neon PostgreSQL"
  - "Redis"
  - "Google Calendar API"
  - "Render"
thumbnail: "/portfolio/voice-cushlabs-thumb.webp"
status: "Production"

problem: "Businesses lose leads to unanswered calls, voicemail black holes, and hold-time abandonment. Hiring receptionists is expensive and still leaves gaps outside business hours. Existing IVR systems frustrate callers with rigid menu trees that never actually solve the problem."
solution: "Production AI voice agents that handle inbound and outbound calls with natural conversation, qualify leads in real time, book appointments directly into Google Calendar, and answer FAQs — 24/7 with sub-500ms response times and zero hold times."
key_features:
  - "5 production demo agents: Clara (lead qualification), James (appointment booking), Sophia (med spa front desk), Mike (home services dispatch), David (real estate outbound setter)"
  - "First outbound AI calling agent — David proactively calls prospects, qualifies buyers, and books property tours via Twilio PSTN"
  - "Real-time Google Calendar integration — checks availability and books confirmed appointments mid-call"
  - "Mock MLS property lookup for real estate demos with 6 NJ listings"
  - "Sub-500ms voice response via Vapi WebRTC with Deepgram STT and Cartesia TTS"
  - "Webhook-driven function calling for calendar, database, MLS lookup, and CRM operations during live calls"
  - "Session state via Redis for multi-turn conversation context across function calls"
  - "Lead data persisted to Neon PostgreSQL with full call metadata"
  - "Full bilingual EN/ES support across all pages"
metrics:
  - "Sub-500ms voice response time"
  - "5 live production demo agents (4 inbound + 1 outbound)"
  - "24/7 availability with zero hold times"
  - "Real-time calendar booking mid-conversation"

demo_url: "https://voice.cushlabs.ai"
live_url: "https://voice.cushlabs.ai"

hero_images:
  - "/portfolio/voice-cushlabs-01.webp"
  - "/portfolio/voice-cushlabs-02.webp"
  - "/portfolio/voice-cushlabs-03.webp"
  - "/portfolio/voice-cushlabs-04.webp"
  - "/portfolio/voice-cushlabs-05.webp"
  - "/portfolio/voice-cushlabs-06.webp"
  - "/portfolio/voice-cushlabs-07.webp"
  - "/portfolio/voice-cushlabs-08.webp"
  - "/portfolio/voice-cushlabs-09.webp"
  - "/portfolio/voice-cushlabs-10.webp"
demo_video_url: "/video/voice-cushlabs-brief.mp4"
demo_video_poster: "/video/voice-cushlabs-brief-poster.webp"
tags:
  - "voice-ai"
  - "vapi"
  - "llm"
  - "real-time"
  - "lead-qualification"
  - "appointment-booking"
  - "customer-support"
  - "outbound-calling"
  - "real-estate"
  - "home-services"
  - "webhooks"
date_completed: "2026-03"
---

## Overview

The CushLabs AI Voice Agent Platform is a production system for deploying conversational AI agents that handle inbound and outbound phone and web calls. Built on the Vapi real-time voice infrastructure, each agent combines an LLM brain (Claude Sonnet or Groq Llama 3.1), speech-to-text (Deepgram Nova-2/3), text-to-speech (Cartesia), and a webhook-driven backend that executes real-world actions — booking calendar appointments, writing lead data to a database, looking up property listings, querying business information — all during a live conversation.

Five demo agents are deployed at voice.cushlabs.ai: Clara handles lead qualification for CushLabs itself, James books executive coaching appointments with real-time Google Calendar integration, Sophia serves as a med spa front desk agent, Mike dispatches home service calls, and David — the platform's first outbound agent — proactively calls real estate prospects via Twilio PSTN to qualify buyers and book property tours.

## The Challenge

- **Lost leads:** Unanswered calls during off-hours, lunch breaks, and peak volume mean revenue walks away
- **IVR frustration:** Menu trees and hold queues create friction that drives callers to competitors
- **Staffing costs:** A full-time receptionist costs $30-50K/year and still only covers business hours
- **No intelligence layer:** Traditional phone systems route calls but cannot qualify, score, or act on the conversation content

## The Solution

**Natural conversation, not menu trees:** Each agent runs a full LLM with a domain-specific system prompt, handling free-form conversation rather than rigid scripted paths.

**Real actions during calls:** Vapi function-calling triggers webhook requests to the Express backend, which executes Google Calendar bookings, database writes, and business logic in real time — the caller hears confirmation within the same conversation.

**Multi-agent architecture:** Each demo agent has its own LLM, voice model, and system prompt optimized for its domain. Clara uses Claude Sonnet for nuanced qualification questions. James uses Groq for ultra-low-latency appointment booking. Sophia uses Claude with a detailed med spa knowledge base. Mike handles home service dispatch with scheduling logic. David makes outbound PSTN calls via Twilio to qualify real estate buyers.

**Inbound + Outbound:** Four agents handle inbound web calls via Vapi Web SDK. David introduces the platform's first outbound calling capability — a server-side endpoint triggers Vapi to call prospects via Twilio PSTN, with mock MLS property lookup and tour booking built into the conversation flow.

**Session persistence:** Redis stores conversation state across multiple function calls within a single session, allowing the agent to reference earlier context when executing later actions.

## Technical Highlights

- **Vapi WebRTC pipeline:** Browser microphone → Deepgram Nova-2/3 STT → LLM (Claude/Groq) → Cartesia TTS → browser speaker, all under 500ms round-trip
- **Outbound PSTN calling:** Server-side POST /api/outbound-call triggers Vapi to call prospects via Twilio with E.164 validation and per-IP rate limiting
- **Webhook function calling:** Vapi triggers POST /api/webhook with structured function call payloads; server routes to calendar, database, MLS lookup, or custom business logic services (8 function handlers)
- **Mock MLS integration:** Property lookup by ID or address for real estate demo with 6 NJ listings
- **Google Calendar OAuth:** Real-time availability checks and event creation with auto-generated Google Meet links during live calls
- **Redis session state:** Maintains conversation context across multiple function calls within a single Vapi session
- **Neon PostgreSQL persistence:** Lead data, call metadata, and booking confirmations stored for CRM integration
- **Full bilingual i18n:** Client-side EN/ES toggle with localStorage persistence, MutationObserver for dynamic Vapi status translation
- **Render deployment:** Express server + Redis instance via Render Blueprint (render.yaml) for reproducible infrastructure

## Results

**For the Business:**
- Every inbound call answered instantly, 24/7 — zero missed leads
- Qualified prospects booked directly into calendar before hanging up
- L1 support handled automatically, human agents reserved for complex issues

**Technical Demonstration:**
- Real-time voice AI with production-grade latency (<500ms)
- Both inbound (Web SDK) and outbound (Twilio PSTN) calling in a single platform
- Webhook-driven architecture that executes real-world actions during live calls (8 function handlers)
- 5-agent deployment across 5 industries with domain-specific LLM, voice, and system prompt configurations
- Full bilingual EN/ES support with client-side i18n
- Infrastructure-as-code via Render Blueprint for reproducible deployments
