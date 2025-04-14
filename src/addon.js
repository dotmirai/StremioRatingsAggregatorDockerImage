const { addonBuilder } = require('stremio-addon-sdk');
const config = require('./config');
const streamHandler = require('./handlers/streamHandler');
const logger = require('./utils/logger');

logger.info(`Initializing addon: ${config.addon.name} v${config.addon.version}`);

// Create addon builder instance with manifest from config
const builder = new addonBuilder(config.addon);

// Register the stream handler
// Stremio calls this when it needs streams for an item (movie/series)
// Our handler will return a "stream" containing the ratings info
builder.defineStreamHandler(streamHandler);

logger.info('Stream handler defined.');

// Export the addon interface for the server
module.exports = builder.getInterface();