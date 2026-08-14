// The assistant registry reads process.env at require time, so every variable
// this suite depends on must be set BEFORE the require below. Setting them
// inside a beforeEach would be too late and the maps would come back empty.
process.env.VAPI_ASSISTANT_ID_CUSHLABS = "id-cushlabs";
process.env.VAPI_ASSISTANT_ID_COACHING = "id-coaching";
process.env.VAPI_ASSISTANT_ID_MEDSPA = "id-medspa";
process.env.VAPI_ASSISTANT_ID_TRADES = "id-trades";
process.env.VAPI_ASSISTANT_ID_REALESTATE = "id-realestate";
process.env.VAPI_ASSISTANT_ID_MEDSPA_ES = "id-medspa-es";
process.env.VAPI_ASSISTANT_ID_TRADES_ES = "id-trades-es";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { demoLabelForAssistantId } = require("../services/assistants");

describe("demoLabelForAssistantId", () => {
  it("names the demo behind each English assistant", () => {
    assert.equal(demoLabelForAssistantId("id-medspa"), "Med Spa Demo");
    assert.equal(demoLabelForAssistantId("id-trades"), "Home Services Demo");
    assert.equal(demoLabelForAssistantId("id-realestate"), "Real Estate Demo");
    assert.equal(demoLabelForAssistantId("id-coaching"), "NYC Coaching Demo");
  });

  it("gives the Spanish variants the same label as their English twin", () => {
    // A caller reaching Sophia in Spanish booked the same demo as one who
    // reached her in English. Two labels for one demo would split the
    // calendar record of which demo actually earns leads.
    assert.equal(demoLabelForAssistantId("id-medspa-es"), "Med Spa Demo");
    assert.equal(demoLabelForAssistantId("id-trades-es"), "Home Services Demo");
  });

  it("does not tag the real CushLabs assistant", () => {
    // Clara qualifies genuine CushLabs leads. She is not a demonstration of
    // someone else's business, so her invites keep the plain title.
    assert.equal(demoLabelForAssistantId("id-cushlabs"), null);
  });

  it("returns null rather than inventing a label it cannot resolve", () => {
    // These land on a real prospect's invite. An unknown assistant must
    // degrade to the untagged title, never to a guess.
    assert.equal(demoLabelForAssistantId("some-unknown-assistant"), null);
    assert.equal(demoLabelForAssistantId(""), null);
    assert.equal(demoLabelForAssistantId(undefined), null);
    assert.equal(demoLabelForAssistantId(null), null);
  });

  it("does not match an assistant whose env var is unset", () => {
    // VAPI_ASSISTANT_ID_COACHING_ES is deliberately not set above. An unset
    // variable is undefined, and undefined must not collide with a caller
    // arriving on an assistant ID we never configured.
    assert.equal(
      demoLabelForAssistantId(process.env.VAPI_ASSISTANT_ID_COACHING_ES),
      null,
    );
  });
});
