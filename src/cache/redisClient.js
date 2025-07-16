// src/cache/redisClient.js
const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

let client;
let ready = false;

// --- Core: init & lifecycle ---
function initClient() {
    if (client) return client;

    client = createClient({ url: config.redis.url });

    client.on('error', err => {
        logger.error('Redis client error:', err);
        ready = false;
    });

    client.on('ready', () => {
        if (!ready) {
            logger.info('✅ Redis client is READY.');
            ready = true;
        }
    });

    client.on('end', () => {
        if (ready) {
            logger.warn('Redis connection closed.');
            ready = false;
        }
    });

    client.connect().catch(err => {
        logger.error('Failed to connect to Redis:', err);
    });

    return client;
}

function isReady() {
    return ready;
}

function getClient() {
    return client;
}

// Optional: retryable connect (not used by default)
async function safeConnect(retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            await client.connect();
            return;
        } catch (err) {
            logger.warn(`Retry ${i + 1}/${retries} Redis connect failed:`, err.message);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error('Redis connection failed after retries');
}

// --- Cache API ---

async function getRatingsHash(key) {
    if (!ready) {
        logger.warn(`[getRatingsHash] Redis not ready, skip "${key}"`);
        return null;
    }

    try {
        const hash = await client.hGetAll(key);
        if (!hash || Object.keys(hash).length === 0) return null;
        return Object.entries(hash).map(([source, value]) => ({ source, value }));
    } catch (err) {
        logger.error(`Error hGetAll "${key}":`, err);
        return null;
    }
}

async function setRatingsHash(key, ratings, ttlSeconds = config.cache.ttlSeconds) {
    if (!ready || !ratings?.length) {
        logger.warn(`[setRatingsHash] Redis not ready or no ratings for "${key}"`);
        return false;
    }

    const hashData = ratings.reduce((o, { source, value }) => {
        o[source] = value.toString();
        return o;
    }, {});

    try {
        await client
            .multi()
            .hSet(key, hashData)
            .expire(key, ttlSeconds)
            .exec();

        logger.debug(`Cached "${key}" (${ratings.length} fields) TTL ${ttlSeconds}s`);
        return true;
    } catch (err) {
        logger.error(`Error caching "${key}":`, err);
        return false;
    }
}

async function getRatingsHashOrMarker(key) {
    if (!ready) {
        logger.warn(`[getRatingsHashOrMarker] Redis not ready, skip "${key}"`);
        return null;
    }

    try {
        const type = await client.type(key);

        if (type === 'hash') {
            const hash = await client.hGetAll(key);
            if (!hash || Object.keys(hash).length === 0) return null;
            return Object.entries(hash).map(([source, value]) => ({ source, value }));
        }

        if (type === 'string') {
            return await client.get(key); // marker
        }

        return null;
    } catch (err) {
        logger.error(`Error checking key type "${key}":`, err);
        return null;
    }
}

async function setNegativeMarker(key, marker, ttlSeconds = config.cache.negativeTtlSeconds) {
    if (!ready) {
        logger.warn(`[setNegativeMarker] Redis not ready, skip "${key}"`);
        return false;
    }

    try {
        const result = await client.set(key, marker, { EX: ttlSeconds });
        logger.debug(`Set negative marker "${key}" = "${marker}" for ${ttlSeconds}s`);
        return result === 'OK';
    } catch (err) {
        logger.error(`Error setting marker "${key}":`, err);
        return false;
    }
}

async function disconnect() {
    if (client && ready) {
        try {
            await client.quit();
            logger.info('Redis client disconnected.');
        } catch (err) {
            logger.error('Error during Redis quit:', err);
        }
    }
    client = null;
    ready = false;
}

// --- Exports ---
module.exports = {
    initClient,
    connect: async () => initClient(), // for compatibility
    isReady,
    getClient,
    getRatingsHash,
    setRatingsHash,
    getRatingsHashOrMarker,
    setNegativeMarker,
    disconnect,
    safeConnect // optional use
};
