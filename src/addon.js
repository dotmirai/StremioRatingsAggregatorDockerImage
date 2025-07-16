const { addonBuilder } = require('stremio-addon-sdk');
const config = require('./config');
const streamHandler = require('./handlers/streamHandler');
const logger = require('./utils/logger');

logger.info(`Initializing addon: ${config.addon.name} v${config.addon.version}`);

const builder = new addonBuilder(config.addon);
builder.defineStreamHandler(streamHandler);
logger.info('Stream handler defined.');

module.exports = builder.getInterface();