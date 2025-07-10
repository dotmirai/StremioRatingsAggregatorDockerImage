const redisClient = require('../cache/redisClient');
const config = require('../config');
const logger = require('../utils/logger');
const { getTmdbData } = require('../utils/tmdbService');
const providers = require('../providers');

const CACHE_PREFIX = 'ratings:';
// Define a specific value to represent "no ratings found" in cache
const NO_RATINGS_MARKER = '___NO_RATINGS___';
// Define a shorter TTL for negative cache entries (e.g., 6 hours)
const NEGATIVE_CACHE_TTL_SECONDS = 6 * 60 * 60;

// Providers that return { source, value } or array thereof
const activeProviders = [
    providers.imdbProvider,
    providers.tmdbProvider,
    providers.metacriticProvider,
    providers.commonSenseProvider,
    providers.cringeMdbProvider,
    providers.rottentomatoesProvider,
    // extend here...
];

/**
 * Calculate a dynamic TTL (in seconds) based on the age of the content.
 * @param {string|null} releaseDate - ISO date string (e.g., "2023-08-15") or null
 * @param {number} numRatings - Number of collected ratings
 * @returns {number} TTL in seconds
 */
function calculateTTL(releaseDate, numRatings) {
    // --- No changes needed in this function ---
    if (!releaseDate) {
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

    if (numRatings <= 3) {
        ttl = Math.min(ttl, 10 * 24 * 60 * 60); // cap at 3 days
    }

    return ttl;
}

/** Normalize a single provider rating object */
function processSingleRating(rating) {
    // --- No changes needed in this function ---
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
 * Includes negative caching.
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
            const cachedValue = await redisClient.getRatingsHashOrMarker(cacheKey); // Use a new function

            if (cachedValue === NO_RATINGS_MARKER) {
                logger.info(`Cache HIT for ${baseId} (Negative Cache)`);
                return null; // Explicitly return null for negatively cached entries
            } else if (cachedValue) {
                logger.info(`Cache HIT for ${baseId} (Hash)`);
                // It's an array of ratings
                return cachedValue;
            }
            logger.info(`Cache MISS for ${baseId}`);
        } catch (err) {
            logger.error(`Error checking cache for ${cacheKey}: ${err.message}`);
        }
    } else {
        logger.warn(`Redis not ready; skipping cache check for ${baseId}.`);
    }

    logger.info(`Aggregating ratings for ${baseId} (${type}) from providers...`);

    // 2) Fetch TMDB data
    const { tmdbId, name, date } = await getTmdbData(imdbId, type);
    // --- TMDB lookup failure itself isn't negatively cached here, ---
    // --- but could be added if getTmdbData was consistently failing for an ID ---
    // --- The current logic proceeds even without tmdbId ---

    const year = date ? new Date(date).getFullYear().toString() : null;
    const streamInfo = { name, year };

    // 3) Fetch from all providers
    const promises = activeProviders.map(provider =>
        provider
            .getRating(type, imdbId, streamInfo, tmdbId)
            .catch(err => {
                logger.error(`Error from ${provider.name} for ${imdbId}: ${err.message}`);
                return null;
            })
    );
    const results = await Promise.all(promises);

    // 4) Process and dedupe ratings
    const allRatings = results
        .filter(ratingData => ratingData)
        .flatMap(data => (Array.isArray(data) ? data : [data]))
        .map(processSingleRating)
        .filter(r => r);

    const uniqueRatingsMap = new Map();
    allRatings.forEach(r => uniqueRatingsMap.set(r.source, r.value));
    const finalRatings = Array.from(uniqueRatingsMap, ([source, value]) => ({ source, value }));

    logger.info(`Found ${finalRatings.length} unique ratings for ${baseId}.`);

    // 5) Cache results OR negative marker
    if (redisClient.isReady()) {
        if (finalRatings.length > 0) {
            // Cache the actual ratings with dynamic TTL
            const ttlSeconds = calculateTTL(date, finalRatings.length);
            try {
                const success = await redisClient.setRatingsHash(cacheKey, finalRatings, ttlSeconds); // Use existing Hash set
                if (success) {
                    logger.debug(`Cached ratings hash for ${baseId} with TTL ${ttlSeconds}s`);
                } else {
                    logger.warn(`Failed to cache ratings hash for ${baseId}`);
                }
            } catch (err) {
                logger.error(`Error caching hash for ${cacheKey}: ${err.message}`);
            }
        } else {
            // Cache the negative result with a shorter, fixed TTL
            logger.info(`No ratings found for ${baseId}, setting negative cache entry.`);
            try {
                const success = await redisClient.setNegativeMarker(cacheKey, NO_RATINGS_MARKER, NEGATIVE_CACHE_TTL_SECONDS); // Use a new function
                if (success) {
                    logger.debug(`Cached negative marker for ${baseId} with TTL ${NEGATIVE_CACHE_TTL_SECONDS}s`);
                } else {
                    logger.warn(`Failed to cache negative marker for ${baseId}`);
                }
            } catch (err) {
                logger.error(`Error caching negative marker for ${cacheKey}: ${err.message}`);
            }
        }
    }

    return finalRatings.length > 0 ? finalRatings : null;
}

module.exports = { getRatings };