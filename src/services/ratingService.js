const redisClient = require('../cache/redisClient');
const config = require('../config');
const logger = require('../utils/logger');
const getStreamNameAndYear = require('../utils/getStreamName');
const providers = require('../providers'); // Import all exported providers
const getTmdbId = require('../utils/getTmdbId');

const CACHE_PREFIX = 'ratings:';

// List of active provider functions to call
const activeProviders = [
    providers.imdbProvider,
    providers.tmdbProvider,
    providers.metacriticProvider,
    providers.commonSenseProvider,
    providers.cringeMdbProvider,
    // Add Letterboxd/RT here if implemented
];

// Helper to normalize or format rating values slightly if needed
function processSingleRating(rating) {
    if (!rating || !rating.source || !rating.value) {
        return null; // Invalid rating object
    }

    // Example: Trim whitespace from value
    rating.value = rating.value.toString().trim();

    // Ensure essential fields exist
    return {
        source: rating.source,
        value: rating.value,
        url: rating.url || null, // Ensure URL exists or is null
        type: rating.type || null, // Ensure type exists or is null
    };
}

/**
 * Fetches ratings, using cache first, then aggregating from providers.
 * @param {string} type - 'movie' or 'series'
 * @param {string} imdbId - IMDb ID (e.g., "tt1234567" or "tt1234567:1:1")
 * @returns {Promise<Array|null>} Array of rating objects or null if error/no data
 */
async function getRatings(type, imdbId) {
    const cacheKey = `${CACHE_PREFIX}${imdbId}`;
    const baseImdbId = imdbId.split(':')[0]; // Use base ID for logging consistency

    // 1. Check Cache
    if (redisClient.isReady()) {
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                logger.info(`Cache HIT for ${imdbId}`);
                return cachedData; // Return data directly from cache
            }
            logger.info(`Cache MISS for ${imdbId}`);
        } catch (err) {
            logger.error(`Redis GET error for key ${cacheKey}: ${err.message}`);
            // Continue to fetch from providers even if cache read fails
        }
    } else {
        logger.warn(`Redis not ready, skipping cache check for ${imdbId}.`);
    }

    // 2. Fetch from Providers if Cache Miss
    logger.info(`Aggregating ratings for ${imdbId} (${type}) from providers...`);
    let streamInfo = null; // Store stream info once
    let tmdbId = null; // Store TMDB ID if needed

    try {
        // Fetch stream name/year needed by some scrapers *once*
        // Check if any active scraper provider actually needs it
        const needsStreamInfo = activeProviders.some(p =>
            ['Metacritic', 'Common Sense', 'CringeMDB'].includes(p.name) // Add others if needed
        );

        // fetch tmdb id 
        if (!tmdbId) {
            tmdbId = await getTmdbId(baseImdbId, type);
            if (!tmdbId) {
                logger.warn(`Could not retrieve TMDB ID for ${baseImdbId}, some scrapers might fail.`);
            }
        }

        if (needsStreamInfo) {
            logger.debug(`Workspaceing stream metadata for ${baseImdbId} as scrapers need it.`);
            streamInfo = await getStreamNameAndYear(baseImdbId, type , tmdbId);
            if (!streamInfo) {
                logger.warn(`Could not retrieve stream metadata for ${baseImdbId}, some scrapers might fail.`);
            }
        } else {
            logger.debug(`Skipping stream metadata fetch for ${baseImdbId} as no active scraper requires it.`);
        }


        // Fetch from all active providers in parallel, collecting all results (success or failure)
        const providerPromises = activeProviders.map(provider =>
            provider.getRating(type, imdbId, streamInfo,tmdbId) // Pass streamInfo if fetched
                .then(result => ({ status: 'fulfilled', value: result, provider: provider.name }))
                .catch(error => ({ status: 'rejected', reason: error, provider: provider.name }))
        );

        // Use Promise.allSettled to wait for all promises regardless of outcome
        const results = await Promise.allSettled(providerPromises);

        let allRatings = [];
        results.forEach(result => {
            // Log provider success/failure from the settled result
            if (result.status === 'fulfilled') {
                const providerName = result.value.provider; // Get provider name from wrapped result
                const ratingData = result.value.value; // Get actual rating data

                if (ratingData) {
                    // Process single rating or array of ratings
                    const processed = Array.isArray(ratingData)
                        ? ratingData.map(processSingleRating).filter(Boolean)
                        : [processSingleRating(ratingData)].filter(Boolean);

                    if (processed.length > 0) {
                        logger.debug(` -> Success from ${providerName}${processed.length > 1 ? ' (multiple)' : ''}`);
                        allRatings = allRatings.concat(processed);
                    } else {
                        logger.debug(` -> ${providerName} returned no valid rating data.`);
                    }
                } else {
                    logger.debug(` -> ${providerName} returned null.`);
                }
            } else { // status === 'rejected'
                const providerName = result.reason.provider; // Get provider name from wrapped error
                logger.error(` -> Error from ${providerName}: ${result.reason.reason?.message || result.reason.reason || 'Unknown error'}`);
            }
        });


        logger.info(`Finished aggregation for ${imdbId}, found ${allRatings.length} valid ratings.`);

        // 3. Update Cache if data was fetched and Redis is available
        if (allRatings.length > 0 && redisClient.isReady()) {
            try {
                await redisClient.set(cacheKey, allRatings, config.cache.ttlSeconds);
            } catch (err) {
                logger.error(`Redis SET error for key ${cacheKey}: ${err.message}`);
                // Failure to cache is not critical, just log it
            }
        } else if (allRatings.length === 0) {
            logger.warn(`No ratings found for ${imdbId} after checking all providers.`);
            // Optional: Cache an empty result for a shorter duration to prevent constant re-fetching?
            // await redisClient.set(cacheKey, [], 3600); // Cache empty for 1 hour
        }

        return allRatings.length > 0 ? allRatings : null; // Return null if absolutely nothing found

    } catch (error) {
        // Catch errors from initial getStreamNameAndYear or other unexpected issues
        logger.error(`FATAL: Unexpected error during rating aggregation for ${imdbId}: ${error.message}`, error);
        return null; // Return null on major failure
    }
}

module.exports = {
    getRatings,
};