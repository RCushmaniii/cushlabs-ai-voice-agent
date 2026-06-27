const { Redis } = require("@upstash/redis");

// Upstash Redis over its REST API (serverless, connectionless — nothing to pool
// or keep alive on the shared box). Replaces the self-hosted node-redis/TCP
// client. Session cache only: lead data keyed by callId with a 24h TTL, cleared
// at end of call (Postgres is the source of truth). The SDK auto-serializes
// objects on set and auto-deserializes on get, so callers pass/receive plain
// objects exactly as before.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Kept for backwards-compatibility (the REST SDK has no persistent client to
// open). Returns the singleton so any direct caller / test keeps working.
async function getRedisClient() {
  return redis;
}

async function storeLeadData(callId, leadData) {
  await redis.set(`lead:${callId}`, leadData, { ex: 86400 }); // 24h TTL
  console.log(`Lead data stored for call ${callId}`);
}

async function getLeadData(callId) {
  return await redis.get(`lead:${callId}`); // object or null (auto-deserialized)
}

async function deleteLeadData(callId) {
  await redis.del(`lead:${callId}`);
  console.log(`Lead data cleared for call ${callId}`);
}

module.exports = { getRedisClient, storeLeadData, getLeadData, deleteLeadData };
