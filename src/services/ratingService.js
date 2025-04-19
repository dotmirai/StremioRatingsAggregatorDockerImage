const redisClient = require('../cache/redisClient');
const config = require('../config');
const logger = require('../utils/logger');
const { getTmdbData } = require('../utils/tmdbService');
const providers = require('../providers');

const CACHE_PREFIX = 'ratings:';

// Providers that return { source, value } or array thereof
const activeProviders = [
    providers.imdbProvider,
    providers.tmdbProvider,
    providers.metacriticProvider,
    providers.commonSenseProvider,
    providers.cringeMdbProvider,
    // extend here...
];

/**
 * Calculate a dynamic TTL (in seconds) based on the age of the content.
 * @param {string|null} releaseDate - ISO date string (e.g., "2023-08-15") or null
 * @param {number} numRatings - Number of collected ratings
 * @returns {number} TTL in seconds
 */
function calculateTTL(releaseDate, numRatings) {
    if (!releaseDate) {
        // Fallback: use default TTL
        return config.cache.ttlSeconds;
    }

    const now = Date.now();
    const released = new Date(releaseDate).getTime();
    const ageDays = Math.floor((now - released) / (1000 * 60 * 60 * 24));

    let ttl;
    if (ageDays <= 14) {
        ttl = 1 * 24 * 60 * 60; // 1 day
    } else if (ageDays <= 30) {
        ttl = 7 * 24 * 60 * 60; // 7 days
    } else if (ageDays <= 90) {
        ttl = 30 * 24 * 60 * 60; // 1 month
    } else if (ageDays <= 180) {
        ttl = 60 * 24 * 60 * 60; // 2 months
    } else if (ageDays <= 365) {
        ttl = 120 * 24 * 60 * 60; // 4 months
    } else if (ageDays <= 2 * 365) {
        ttl = 240 * 24 * 60 * 60; // 8 months
    } else if (ageDays <= 4 * 365) {
        ttl = 730 * 24 * 60 * 60; // 2 years
    } else {
        ttl = 4 * 365 * 24 * 60 * 60; // 4 years
    }

    // If few ratings found, reduce TTL assuming scrape failure
    if (numRatings <= 3) {
        ttl = Math.min(ttl, 3 * 24 * 60 * 60); // cap at 3 days
    }

    return ttl;
}

/** Normalize a single provider rating object */
function processSingleRating(rating) {
    if (!rating || !rating.source || !rating.value) {
        return null;
    }
    return {
        source: rating.source,
        value: rating.value.toString().trim(),
    };
}

/**
 * Aggregates ratings for a given IMDb ID and type.
 * Uses Redis cache, falls back to providers, then updates cache with dynamic TTL.
 *
 * @param {'movie'|'series'} type
 * @param {string} imdbId  IMDb ID, may include :S:E suffix
 * @returns {Promise<Array<{source:string,value:string}>|null>}
 */
async function getRatings(type, imdbId) {
    const baseId = imdbId.split(':')[0];
    const cacheKey = `${CACHE_PREFIX}${type}:${baseId}`;

    // 1) Try cache
    if (redisClient.isReady()) {
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                logger.info(`Cache HIT for ${baseId}`);
                return cached;
            }
            logger.info(`Cache MISS for ${baseId}`);
        } catch (err) {
            logger.error(`Redis GET error for ${cacheKey}: ${err.message}`);
        }
    } else {
        logger.warn(`Redis not ready; skipping cache for ${baseId}.`);
    }

    logger.info(`Aggregating ratings for ${baseId} (${type}) from providers...`);

    // 2) Fetch TMDB data (ID + metadata) once
    const { tmdbId, name, date } = await getTmdbData(imdbId, type);
    if (!tmdbId) {
        logger.warn(`No TMDB ID for ${baseId}; some providers may fail.`);
    }

    const year = date ? new Date(date).getFullYear().toString() : null;
    const streamInfo = { name, year };

    // 3) Fetch from all providers in parallel
    const promises = activeProviders.map(provider =>
        provider
            .getRating(type, imdbId, streamInfo, tmdbId)
            .catch(err => {
                logger.error(`Error from ${provider.name}: ${err.message}`);
                return null;
            })
    );

    const results = await Promise.all(promises);

    // 4) Process and dedupe ratings, dropping any nulls
    const allRatings = results
        .filter(ratingData => ratingData)
        .flatMap(data => (Array.isArray(data) ? data : [data]))
        .map(processSingleRating)
        .filter(r => r);

    logger.info(`Found ${allRatings.length} ratings for ${baseId}.`);

    // 5) Cache if we got any, using dynamic TTL based on release date and rating count
    if (allRatings.length > 0 && redisClient.isReady()) {
        const ttlSeconds = calculateTTL(date, allRatings.length);
        try {
            await redisClient.set(cacheKey, allRatings, ttlSeconds);
            logger.debug(`Cached ${baseId} with TTL ${ttlSeconds}s`);
        } catch (err) {
            logger.error(`Redis SET error for ${cacheKey}: ${err.message}`);
        }
    }

    return allRatings.length > 0 ? allRatings : null;
}

module.exports = { getRatings };
