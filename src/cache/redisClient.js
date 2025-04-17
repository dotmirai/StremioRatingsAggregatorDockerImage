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

    redisClient = createClient({
        url: config.redis.url,
        socket: {
            // initial connect timeout
            connectTimeout: 5000,
            // reconnect strategy: wait X ms before each retry (capped at 2s), stop after 10 tries
            reconnectStrategy: (attempts) => {
                if (attempts > 10) {
                    logger.error('Redis reconnect attempts exhausted.');
                    return new Error('Retry time exhausted');
                }
                const delay = Math.min(attempts * 100, 2000);
                logger.info(`Redis reconnecting in ${delay}ms (attempt #${attempts})`);
                return delay;
            }
        }
    });

    redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
        isConnected = false;
    });

    redisClient.on('ready', () => {
        logger.info('✅ Redis client is READY.');
        isConnected = true;
    });

    // you can log the first connect attempt too if you want
    logger.info('Attempting initial Redis connection…');
    try {
        await redisClient.connect();
    } catch (err) {
        // .connect only throws if the reconnectStrategy returns an Error
        logger.error('Fatal Redis connection failure:', err);
    }

    return redisClient;
};

const getClient = () => {
    if (!isConnected || !redisClient) {
        logger.warn('Redis client requested but not connected; returning null.');
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