const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient;
let isConnected = false;

const connect = async () => {
    if (isConnected) {
        logger.debug('Redis client already connected.');
        return redisClient;
    }

    redisClient = createClient({ url: config.redis.url });

    redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        isConnected = false; // Mark as disconnected on error
        // Optional: Implement retry logic here
    });

    redisClient.on('connect', () => {
        logger.info('Connecting to Redis...');
    });

    redisClient.on('ready', () => {
        logger.info('Redis client connected successfully.');
        isConnected = true;
    });

    redisClient.on('end', () => {
        logger.warn('Redis client connection closed.');
        isConnected = false;
    });

    try {
        await redisClient.connect();
    } catch (err) {
        logger.error('Failed to connect to Redis initially:', err);
        // Depending on strategy, you might exit or let the app run without cache
    }

    return redisClient;
};

const getClient = () => {
    if (!isConnected || !redisClient) {
        logger.warn('Redis client requested but not connected.');
        // Optionally try to reconnect here, or just return null/undefined
        // return connect(); // Be careful with async initialization here
        return null;
    }
    return redisClient;
};

const get = async (key) => {
    const client = getClient();
    if (!client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        logger.error(`Error getting key "${key}" from Redis:`, err);
        return null;
    }
};

const set = async (key, value, ttlSeconds = config.cache.ttlSeconds) => {
    const client = getClient();
    if (!client) return false;
    try {
        const stringValue = JSON.stringify(value);
        await client.set(key, stringValue, { EX: ttlSeconds });
        logger.debug(`Successfully set cache for key "${key}" with TTL ${ttlSeconds}s`);
        return true;
    } catch (err) {
        logger.error(`Error setting key "${key}" in Redis:`, err);
        return false;
    }
};

const disconnect = async () => {
    if (redisClient && isConnected) {
        try {
            await redisClient.quit();
            logger.info('Redis client disconnected.');
        } catch (err) {
            logger.error('Error disconnecting Redis client:', err);
        } finally {
            isConnected = false;
            redisClient = null;
        }
    }
};


module.exports = {
    connect,
    getClient,
    get,
    set,
    disconnect,
    isReady: () => isConnected,
};