// src/cache/redisClient.js
const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

let client;
let ready = false;

/** Initialize (or return) the single Redis client */
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
            logger.warn('Redis client connection closed.');
            ready = false;
        }
    });

    client.connect().catch(err => {
        logger.error('Failed to connect to Redis:', err);
    });

    return client;
}

/** Check readiness */
function isReady() {
    return ready;
}

/** Retrieve ratings hash */
async function getRatingsHash(key) {
    const redis = initClient();
    if (!ready) {
        logger.warn(`[getRatingsHash] Redis not ready, skipping "${key}"`);
        return null;
    }
    try {
        const hash = await redis.hGetAll(key);
        if (!hash || Object.keys(hash).length === 0) return null;
        return Object.entries(hash).map(([source, value]) => ({ source, value }));
    } catch (err) {
        logger.error(`Error hGetAll "${key}":`, err);
        return null;
    }
}

/** Store ratings hash + TTL */
async function setRatingsHash(key, ratings, ttlSeconds = config.cache.ttlSeconds) {
    const redis = initClient();
    if (!ready || !ratings || ratings.length === 0) {
        if (!ratings || ratings.length === 0)
            logger.warn(`[setRatingsHash] No ratings for "${key}", skip`);
        else
            logger.warn(`[setRatingsHash] Redis not ready, cannot set "${key}"`);
        return false;
    }

    const hashData = ratings.reduce((o, { source, value }) => {
        o[source] = value.toString();
        return o;
    }, {});

    try {
        await redis
            .multi()
            .hSet(key, hashData)
            .expire(key, ttlSeconds)
            .exec();
        logger.debug(`Cached "${key}" (${ratings.length} fields) TTL ${ttlSeconds}s`);
        return true;
    } catch (err) {
        logger.error(`Error multi.exec for "${key}":`, err);
        return false;
    }
}

/** Retrieve hash or negative marker */
async function getRatingsHashOrMarker(key) {
    const redis = initClient();
    if (!ready) {
        logger.warn(`[getRatingsHashOrMarker] Redis not ready, skip "${key}"`);
        return null;
    }
    try {
        const type = await redis.type(key);
        if (type === 'hash') {
            const hash = await redis.hGetAll(key);
            if (!hash || !Object.keys(hash).length) return null;
            return Object.entries(hash).map(([s, v]) => ({ source: s, value: v }));
        }
        if (type === 'string') {
            return await redis.get(key);
        }
        return null;
    } catch (err) {
        logger.error(`Error type/get for "${key}":`, err);
        return null;
    }
}

/** Store negative-cache marker */
async function setNegativeMarker(key, marker, ttlSeconds = config.cache.negativeTtlSeconds) {
    const redis = initClient();
    if (!ready) {
        logger.warn(`[setNegativeMarker] Redis not ready, skip "${key}"`);
        return false;
    }
    try {
        return (await redis.set(key, marker, { EX: ttlSeconds })) === 'OK';
    } catch (err) {
        logger.error(`Error set negative marker for "${key}":`, err);
        return false;
    }
}

/** Disconnect client */
async function disconnect() {
    if (client && ready) {
        try {
            await client.quit();
            logger.info('Redis client disconnected.');
        } catch (err) {
            logger.error('Error during Redis quit:', err);
        } finally {
            client = null;
            ready = false;
        }
    } else {
        client = null;
        ready = false;
    }
}

module.exports = {
    initClient,
    isReady,
    connect: async () => initClient(), // keep compatibility
    getRatingsHash,
    setRatingsHash,
    getRatingsHashOrMarker,
    setNegativeMarker,
    disconnect
};
