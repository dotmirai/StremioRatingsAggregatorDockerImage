#!/usr/bin/env node

// Load environment variables first
require('dotenv').config();

const { serveHTTP } = require('stremio-addon-sdk');
const config = require('./config'); // Load config after dotenv
const addonInterface = require('./addon');
const redisClient = require('./cache/redisClient');
const logger = require('./utils/logger');

async function startServer() {
    logger.info('Starting addon server...');

    // Initialize Redis connection
    await redisClient.connect();

    if (!redisClient.isReady()) {
        logger.warn('Redis connection failed or not ready. Addon will run WITHOUT caching.');
        // Decide if you want to exit or run without cache
        // process.exit(1);
    }

    // Start the HTTP server
    serveHTTP(addonInterface, { port: config.port })
        .then(({ url }) => {
            logger.info(`Addon server listening on ${url}`);
            logger.info(`Configure Stremio with: ${url}/manifest.json`);

            // Optional: Publish to community addon list (uncomment when deployed)
            // const manifestUrl = "YOUR_DEPLOYED_MANIFEST_URL"; // e.g., https://your-addon-domain/manifest.json
            // publishToCentral(manifestUrl)
            //    .then(() => logger.info(`Published to central catalog: ${manifestUrl}`))
            //    .catch(err => logger.error('Failed to publish to central:', err));
        })
        .catch(err => {
            logger.error('Failed to start addon server:', err);
            process.exit(1);
        });
}

// Graceful shutdown
async function shutdown(signal) {
    logger.warn(`Received ${signal}. Shutting down...`);
    await redisClient.disconnect();
    // Add any other cleanup here
    logger.info('Shutdown complete.');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();