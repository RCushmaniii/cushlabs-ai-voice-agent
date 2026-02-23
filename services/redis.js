const redis = require('redis');

let client = null;

async function getRedisClient() {
    if (client && client.isOpen) return client;

    client = redis.createClient({ url: process.env.REDIS_URL });

    client.on('error', (err) => {
        console.error('Redis connection error:', err.message);
    });

    client.on('connect', () => {
        console.log('Connected to Redis');
    });

    await client.connect();
    return client;
}

async function storeLeadData(callId, leadData) {
    const redisClient = await getRedisClient();
    const key = `lead:${callId}`;
    await redisClient.set(key, JSON.stringify(leadData), { EX: 86400 }); // 24h TTL
    console.log(`Lead data stored for call ${callId}`);
}

async function getLeadData(callId) {
    const redisClient = await getRedisClient();
    const key = `lead:${callId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
}

async function deleteLeadData(callId) {
    const redisClient = await getRedisClient();
    const key = `lead:${callId}`;
    await redisClient.del(key);
    console.log(`Lead data cleared for call ${callId}`);
}

module.exports = { getRedisClient, storeLeadData, getLeadData, deleteLeadData };
