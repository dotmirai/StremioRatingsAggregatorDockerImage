require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config');
const addonInterface = require('./addon');
const { getRouter } = require('stremio-addon-sdk');
const redisClient = require('./cache/redisClient');

async function startServer() {
    logger.info('Starting addon server...');

    // Initialize Redis connection
    try {
        if (!redisClient.isReady()) await redisClient.connect();
        logger.info('Redis connected successfully.');
    } catch (err) {
        logger.warn('Redis unavailable:', err.message);
    }

    // Create Express app
    const app = express();

    // Serve any static files you place in ./public
    const distPath = path.join(__dirname, '../frontend/dist');
    app.use('/configure', express.static(distPath));
    
    // Serve the index.html file for the root path
    app.get('/', (_req, res) => {
        res.redirect('/configure');
    });

    app.get('/configure', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            redis: redisClient.isReady(),
            uptime: process.uptime(),
        });
    });



    // Mount the Stremio addon (manifest.json, API, etc.)
    app.use(getRouter(addonInterface));
    logger.info('Addon router mounted.');

    // Start HTTP server
    const port = config.port;
    app.listen(port, () => {
        const url = `http://localhost:${port}`;
        logger.info(`Addon server listening on ${url}`);
        logger.info(`Access the addon manifest at ${url}/manifest.json`);
    });
}

// Graceful shutdown
async function shutdown(signal) {
    logger.warn(`Received ${signal}. Shutting down...`);
    await redisClient.disconnect();
    logger.info('Shutdown complete.');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
