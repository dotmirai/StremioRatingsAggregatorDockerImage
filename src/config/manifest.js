// config/manifest.js
require('dotenv').config();
const pkg = require('../../package.json');

module.exports = {
    id: 'community.ratings.aggregator',
    version: pkg.version || '0.0.0',
    name: process.env.ADDON_SUFFIX
        ? `🎯 Ratings Aggregator | ${process.env.ADDON_SUFFIX}`
        : '🎯 Ratings Aggregator',
    description: 'Tired of tab-hopping? Get all your essential movie and series ratings in one place! Aggregates scores from IMDb, TMDb, Metacritic (critic & user), Common Sense Media, and CringeMDB (parent-safe tags). Streamline your watch decisions!',
    logo: 'https://emojicdn.elk.sh/%F0%9F%8E%AF?style=google',
    catalogs: [],
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    behaviorHints: {
        configurable: true,
        configurationRequired: false,
    }
};