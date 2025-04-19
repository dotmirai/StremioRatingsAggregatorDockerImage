// src/cache/redisClient.js
const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');
// zlib is no longer needed here

let redisClient;
let isConnected = false;

/**
 * Connect (or reuse) the Redis client.
 */
async function connect() {
    if (isConnected && redisClient) return redisClient;
    if (redisClient) { // Handle potential case where client exists but is not connected
        try {
            await redisClient.quit();
        } catch (err) {
            logger.warn('Error quitting previous disconnected client:', err);
        }
        redisClient = null;
        isConnected = false;
    }

    logger.info('Attempting Redis connection…');
    try {
        redisClient = createClient({ url: config.redis.url });

        redisClient.on('error', err => {
            logger.error('Redis client error:', err);
            isConnected = false;
            // Optionally implement reconnection logic here or rely on node-redis internal retry
        });

        redisClient.on('ready', () => {
            if (!isConnected) {
                logger.info('✅ Redis client is READY.');
                isConnected = true;
            }
        });

        redisClient.on('end', () => {
            if (isConnected) {
                logger.warn('Redis client connection closed.');
                isConnected = false;
            }
        });

        await redisClient.connect();
        return redisClient;
    } catch (err) {
        logger.error('Initial Redis connection failed:', err);
        redisClient = null; // Ensure client is null if connect fails
        isConnected = false;
        throw err; // Rethrow to indicate connection failure
    }
}

/**
 * Retrieve ratings stored as a Hash from Redis.
 * @param {string} key - The Redis key (e.g., "ratings:movie:tt1234567")
 * @returns {Promise<Array<{source: string, value: string}> | null>} - Array of ratings or null if not found/error.
 */
async function getRatingsHash(key) {
    if (!isConnected || !redisClient) {
        logger.warn(`[getRatingsHash] Redis not connected, cannot get key "${key}"`);
        return null;
    }
    try {
        // HGETALL returns an object { field1: value1, field2: value2 }
        const hashData = await redisClient.hGetAll(key);

        // Check if hash exists and is not empty
        if (!hashData || Object.keys(hashData).length === 0) {
            return null; // Key doesn't exist or hash is empty
        }

        // Transform the object into the desired array format
        const ratings = Object.entries(hashData).map(([source, value]) => ({
            source,
            value, // Values are stored directly as strings
        }));

        return ratings.length > 0 ? ratings : null;
    } catch (err) {
        logger.error(`Error getting hash key "${key}" from Redis:`, err);
        return null;
    }
}

/**
 * Store ratings as a Redis Hash with an expiry.
 * @param {string} key - The Redis key (e.g., "ratings:movie:tt1234567")
 * @param {Array<{source: string, value: string}>} ratings - Array of ratings to store.
 * @param {number} ttlSeconds - TTL for the key in seconds.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function setRatingsHash(key, ratings, ttlSeconds = config.cache.ttlSeconds) {
    if (!isConnected || !redisClient) {
        logger.warn(`[setRatingsHash] Redis not connected, cannot set key "${key}"`);
        return false;
    }
    if (!ratings || ratings.length === 0) {
        logger.warn(`[setRatingsHash] No ratings provided for key "${key}", not setting.`);
        // Optionally delete the key if it exists and ratings are now empty
        // try { await redisClient.del(key); } catch(e) { /* ignore */ }
        return false;
    }

    try {
        // Prepare data for HSET: ['source1', 'value1', 'source2', 'value2', ...]
        // Important: HSET expects arguments as field, value, field, value...
        // Or starting Redis 4.0, it accepts an object { field1: value1, ... }
        // Let's use the object form for clarity if supported, fallback to array spread
        const hashData = ratings.reduce((obj, item) => {
            obj[item.source] = item.value.toString(); // Ensure value is string
            return obj;
        }, {});

        // Use MULTI/EXEC for atomicity: Set hash fields and expire together
        const multi = redisClient.multi();
        multi.hSet(key, hashData); // Set/overwrite fields in the hash
        multi.expire(key, ttlSeconds); // Set the TTL on the hash key itself

        const replies = await multi.exec();

        // Check results (replies array should contain results of hSet and expire)
        // A failure in exec will throw, or replies might contain null/errors
        // For simplicity, we check if exec didn't throw and assume success if connected.
        // node-redis v4 exec returns array of results or throws on transaction error.
        logger.debug(`Cached ratings hash "${key}" (${Object.keys(hashData).length} fields) with TTL ${ttlSeconds}s`);
        return true;

    } catch (err) {
        logger.error(`Error setting hash key "${key}" in Redis:`, err);
        // Attempt to clean up potentially partially set key without TTL?
        // Or rely on subsequent operations to overwrite / TTL to eventually clear.
        return false;
    }
}

async function disconnect() {
    if (redisClient && isConnected) {
        try {
            await redisClient.quit();
            logger.info('Redis client disconnected.');
        } catch (err) {
            logger.error('Error during Redis quit:', err);
        } finally {
            isConnected = false;
            redisClient = null;
        }
    } else if (redisClient) {
        // Client exists but wasn't connected, ensure it's nullified
        redisClient = null;
        isConnected = false; // Ensure state consistency
    }
}


/**
 * Retrieve ratings stored as a Hash OR a negative cache marker from Redis.
 * Determines the type based on whether the value is a Hash or a simple string.
 * @param {string} key - The Redis key
 * @returns {Promise<Array<{source: string, value: string}> | string | null>} - Array of ratings, the marker string, or null.
 */
async function getRatingsHashOrMarker(key) {
    if (!isConnected || !redisClient) {
        logger.warn(`[getRatingsHashOrMarker] Redis not connected, cannot get key "${key}"`);
        return null;
    }
    try {
        // Check the type of the key first
        const type = await redisClient.type(key);

        if (type === 'hash') {
            // It's our ratings hash
            const hashData = await redisClient.hGetAll(key);
            if (!hashData || Object.keys(hashData).length === 0) {
                return null; // Hash exists but is empty, treat as miss
            }
            const ratings = Object.entries(hashData).map(([source, value]) => ({
                source,
                value,
            }));
            return ratings.length > 0 ? ratings : null;

        } else if (type === 'string') {
            // Assume it's our negative cache marker
            const marker = await redisClient.get(key);
            // Check if the fetched marker is the one we expect
            // (This check might be optional if only markers are stored as strings under this prefix)
            // if (marker === NO_RATINGS_MARKER) { // NO_RATINGS_MARKER is defined in ratingService
            //    return marker;
            // }
            // If it's some other string, maybe treat as miss or log warning
            // logger.warn(`[getRatingsHashOrMarker] Found string for key "${key}" but not expected marker: ${marker}`);
            // return null;
            return marker; // Return the string directly, let service check it

        } else if (type === 'none') {
            // Key doesn't exist
            return null;
        } else {
            // Unexpected type for this key
            logger.warn(`[getRatingsHashOrMarker] Unexpected type "${type}" for key "${key}"`);
            return null;
        }
    } catch (err) {
        logger.error(`Error getting hash or marker for key "${key}" from Redis:`, err);
        return null;
    }
}

/**
 * Store a simple string marker (for negative caching) in Redis with an expiry.
 * @param {string} key - The Redis key
 * @param {string} marker - The string value to store (e.g., "___NO_RATINGS___")
 * @param {number} ttlSeconds - TTL for the key in seconds.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function setNegativeMarker(key, marker, ttlSeconds) {
    if (!isConnected || !redisClient) {
        logger.warn(`[setNegativeMarker] Redis not connected, cannot set key "${key}"`);
        return false;
    }
    try {
        // Simple SET with EXpiry option
        const result = await redisClient.set(key, marker, { EX: ttlSeconds });
        return result === 'OK';
    } catch (err) {
        logger.error(`Error setting negative marker key "${key}" in Redis:`, err);
        return false;
    }
}


module.exports = {
    connect,
    getRatingsHash, // Keep original hash getter if needed elsewhere
    setRatingsHash,
    getRatingsHashOrMarker, // New getter for combined logic
    setNegativeMarker,   // New setter for markers
    disconnect,
    isReady: () => isConnected,
};