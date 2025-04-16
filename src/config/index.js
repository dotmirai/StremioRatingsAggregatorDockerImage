require('dotenv').config();

const config = {
    port: process.env.PORT || 61262,
    logLevel: process.env.LOG_LEVEL || 'info',
    tmdb: {
        apiKey: process.env.TMDB_API_KEY,
        apiUrl: 'https://api.themoviedb.org/3',
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    cache: {
        // Default TTL: 24 hours in seconds
        ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '172800', 10),
    },
    sources: {
        imdbBaseUrl: 'https://www.imdb.com',
        metacriticBaseUrl: 'https://www.metacritic.com',
        commonSenseBaseUrl: 'https://www.commonsensemedia.org',
        cringeMdbBaseUrl: 'https://cringemdb.com',
        // Add other base URLs if needed
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    addon: {
        id: 'community.ratings.aggregator',
        version: '1.0.1',
        name: '🎯 Ratings Aggregator',
        description: 'Aggregated ratings from IMDb, TMDb, Metacritic, Common Sense, CringeMDB and more.',
        catalogs: [], // No catalogs offered
        resources: ['stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'], // Only react to IMDb IDs
        behaviorHints: {
            configurable: false,
            configurationRequired: false,
        }
    }
};

// Validate essential config
if (!config.tmdb.apiKey) {
    console.error('FATAL ERROR: TMDB_API_KEY is not set in the environment variables (.env file).');
    console.error('Please get a key from https://www.themoviedb.org/ and add it to your .env file.');
    process.exit(1); // Exit if key is missing
}
if (!config.redis.url) {
    console.warn('WARNING: REDIS_URL is not set. Caching will likely fail. Defaulting to redis://localhost:6379');
}


module.exports = config;