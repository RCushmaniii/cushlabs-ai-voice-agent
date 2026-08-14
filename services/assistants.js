/**
 * Vapi assistant registry.
 *
 * These maps used to live inline in server.js, where only the /api/config route
 * could see them. The Vapi webhook needs the same knowledge in reverse — given
 * the assistant ID on an inbound call, which demo is the caller talking to — so
 * the maps live here and both consumers import them.
 *
 * Why the reverse lookup matters: every persona books onto ONE Google Calendar
 * through the same bookAppointment(). Without a label, a booking taken by the
 * med spa receptionist and one taken by the contractor dispatcher produce
 * byte-identical event titles, and there is no way to tell from the calendar
 * which demo actually earned the lead.
 */

const assistants = {
  cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS,
  coaching: process.env.VAPI_ASSISTANT_ID_COACHING,
  medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA,
  trades: process.env.VAPI_ASSISTANT_ID_TRADES,
  realestate: process.env.VAPI_ASSISTANT_ID_REALESTATE,
};

const assistantsEs = {
  cushlabs: process.env.VAPI_ASSISTANT_ID_CUSHLABS_ES,
  coaching: process.env.VAPI_ASSISTANT_ID_COACHING_ES,
  medspa: process.env.VAPI_ASSISTANT_ID_MEDSPA_ES,
  trades: process.env.VAPI_ASSISTANT_ID_TRADES_ES,
};

// Human label per service, for the calendar event title.
//
// `cushlabs` is deliberately absent. Clara is the real CushLabs lead qualifier,
// not a demonstration of someone else's business, so her bookings get the plain
// untagged title. Every other persona is a fictitious business built to show
// what the voice agent can do, and the tag says which one.
const DEMO_LABELS = {
  coaching: "NYC Coaching Demo",
  medspa: "Med Spa Demo",
  trades: "Home Services Demo",
  realestate: "Real Estate Demo",
};

/**
 * Resolve a Vapi assistant ID to its demo label.
 *
 * Returns null for the CushLabs assistant, for an unrecognized ID, and when the
 * relevant env var is unset — all three mean "do not tag", which degrades to
 * exactly the titles this service produced before. An assistant we cannot name
 * must never invent a name for itself on a real prospect's invite.
 */
function demoLabelForAssistantId(assistantId) {
  if (!assistantId) return null;

  for (const [service, id] of Object.entries(assistants)) {
    if (id && id === assistantId) return DEMO_LABELS[service] || null;
  }
  for (const [service, id] of Object.entries(assistantsEs)) {
    if (id && id === assistantId) return DEMO_LABELS[service] || null;
  }
  return null;
}

module.exports = {
  assistants,
  assistantsEs,
  DEMO_LABELS,
  demoLabelForAssistantId,
};
