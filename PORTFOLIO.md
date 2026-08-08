---
# =============================================================================
# PORTFOLIO.md — CushLabs AI Voice Agent
# =============================================================================
portfolio_enabled: true
portfolio_priority: 3
portfolio_featured: true
portfolio_last_reviewed: "2026-04-05"

title: "AI Voice Agent Platform"
tagline: "AI phone agents that answer calls, qualify leads, and book appointments — 24/7, under 500ms response"
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
  - "Docker"
  - "Hetzner VPS"
  - "Caddy"
  - "Sentry"
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
  - "Sentry error monitoring with Express error handler and performance tracing"
  - "Content-Security-Policy, HSTS, and full security header hardening"
  - "Startup environment validation with fail-fast on missing critical vars"
  - "28-test suite covering endpoints, auth, webhook routing, and security headers"
  - "Full bilingual EN/ES support across all pages"
metrics:
  - "Sub-500ms voice response time"
  - "5 live production demo agents (4 inbound + 1 outbound)"
  - "24/7 availability with zero hold times"
  - "Real-time calendar booking mid-conversation"

demo_url: "https://voice.cushlabs.ai"
live_url: "https://voice.cushlabs.ai"

hero_images:
  - src: "/portfolio/voice-cushlabs-01.webp"
    alt_en: "CushLabs AI Voice Agent landing page at voice.cushlabs.ai showing the demo agent lineup"
    alt_es: "Página principal del Agente de Voz con IA de CushLabs en voice.cushlabs.ai que muestra la lista de agentes de demostración"
  - src: "/portfolio/voice-cushlabs-02.webp"
    alt_en: "Clara lead-qualification voice agent demo screen with live call controls"
    alt_es: "Pantalla de demostración del agente de voz Clara para calificación de prospectos con controles de llamada en vivo"
  - src: "/portfolio/voice-cushlabs-03.webp"
    alt_en: "James appointment-booking agent showing real-time Google Calendar availability during a call"
    alt_es: "Agente James de reservación de citas que muestra la disponibilidad de Google Calendar en tiempo real durante una llamada"
  - src: "/portfolio/voice-cushlabs-04.webp"
    alt_en: "Sophia med spa front desk voice agent answering FAQs and booking treatments"
    alt_es: "Agente de voz Sophia de recepción de spa médico que responde preguntas frecuentes y agenda tratamientos"
  - src: "/portfolio/voice-cushlabs-05.webp"
    alt_en: "Mike home services dispatch agent capturing a service request mid-conversation"
    alt_es: "Agente Mike de despacho de servicios para el hogar que captura una solicitud de servicio durante la conversación"
  - src: "/portfolio/voice-cushlabs-06.webp"
    alt_en: "David outbound real estate agent placing a Twilio PSTN call to qualify a buyer"
    alt_es: "Agente saliente de bienes raíces David realizando una llamada por Twilio PSTN para calificar a un comprador"
  - src: "/portfolio/voice-cushlabs-07.webp"
    alt_en: "Live call interface showing the Vapi voice agent status and transcript in progress"
    alt_es: "Interfaz de llamada en vivo que muestra el estado del agente de voz Vapi y la transcripción en curso"
  - src: "/portfolio/voice-cushlabs-08.webp"
    alt_en: "Mock MLS property lookup results for the real estate demo with New Jersey listings"
    alt_es: "Resultados de búsqueda de propiedades de MLS simulado para la demostración de bienes raíces con propiedades en Nueva Jersey"
  - src: "/portfolio/voice-cushlabs-09.webp"
    alt_en: "Appointment confirmation booked into Google Calendar with an auto-generated Google Meet link"
    alt_es: "Confirmación de cita agendada en Google Calendar con un enlace de Google Meet generado automáticamente"
  - src: "/portfolio/voice-cushlabs-10.webp"
    alt_en: "Bilingual EN/ES interface toggle on the voice agent platform"
    alt_es: "Selector de interfaz bilingüe inglés/español en la plataforma del agente de voz"
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
date_completed: "2026-03"

# === REPO HEALTH STATUS ===
# Last audited: 2026-04-05
# Standards defined in: operating-system/delivery/repo-health-baseline.md
health_status:
  sentry: "Y"
  testing: "Y"
  ci_cd: "Y"
  health_endpoint: "n/a"
  security_headers: "Y"
  rate_limiting: "n/a"
  env_validation: "-"
  analytics: "DEFERRED"
  structured_logging: "-"
  dependabot: "Y"
  secret_scanning: "Y"
  db_backup: "-"
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
- **Outbound PSTN calling:** Server-side POST /api/outbound-call triggers Vapi to call prospects via Twilio with E.164 validation, per-IP throttling and a global daily spend ceiling. _Built and working; switched off on the public demo since 2026-08-06 as a cost control, so the dial form there is disabled by design rather than broken. Available on request._
- **Webhook function calling:** Vapi triggers POST /api/webhook with structured function call payloads; server routes to calendar, database, MLS lookup, or custom business logic services (8 function handlers)
- **Mock MLS integration:** Property lookup by ID or address for real estate demo with 6 NJ listings
- **Google Calendar OAuth:** Real-time availability checks and event creation with auto-generated Google Meet links during live calls
- **Redis session state:** Maintains conversation context across multiple function calls within a single Vapi session
- **Neon PostgreSQL persistence:** Lead data, call metadata, and booking confirmations stored for CRM integration
- **Full bilingual i18n:** Client-side EN/ES toggle with localStorage persistence, MutationObserver for dynamic Vapi status translation
- **Hetzner VPS deployment:** Dockerized Express + Redis behind Caddy reverse proxy with auto-TLS, deployed via docker-compose
- **Sentry error monitoring:** Production error tracking with Express error handler and 20% performance trace sampling
- **Security hardening:** Content-Security-Policy tuned per-app, HSTS with preload, and startup env validation
- **Test suite:** 28 tests using Node.js built-in test runner covering health, security headers, config, contact form, webhook auth, and all webhook event handlers

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
- Dockerized deployment on Hetzner VPS with Caddy auto-TLS, Sentry monitoring, and 28-test suite
