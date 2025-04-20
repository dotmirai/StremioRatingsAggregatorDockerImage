// providers/rottentomatoesProvider.js
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'Rotten Tomatoes';
const BASE_URL = config.sources.rottentomatoesBaseUrl;

// providers/rottentomatoesProvider.js
// ... other imports ...

function formatRottenTomatoesSlug(title) {
    if (!title) return '';

    return title
        .toLowerCase()
        // Handle special cases first
        .replace(/[:_]/g, ' ') // Convert existing colons/underscores to spaces
        .replace(/['’]/g, '')  // Remove apostrophes
        // Replace spaces with underscores
        .replace(/\s+/g, '_')
        // Remove other special characters
        .replace(/[^a-z0-9_]/g, '')
        // Collapse consecutive underscores
        .replace(/_+/g, '_')
        // Trim leading/trailing underscores
        .replace(/^_|_$/g, '');
}

function getRottenTomatoesUrl(title, type) {
    if (!title || !BASE_URL) return null;

    const mediaPath = type === 'series' ? 'tv' : 'm';
    const formattedTitle = formatRottenTomatoesSlug(title);
    if (!formattedTitle) return null;

    return `${BASE_URL}/${mediaPath}/${formattedTitle}`;
}

function scrapeDomRatings($, url) {
    const ratings = [];

    try {
        // Critics Score
        const criticsScoreElem = $('rt-text[slot="criticsScore"]');
        if (criticsScoreElem.length) {
            const scoreText = criticsScoreElem.first().text().trim();
            const scoreValue = parseInt(scoreText, 10);
            if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 100) {
                ratings.push({
                    source: 'RT',
                    value: `${scoreValue}%`,
                    type: 'Critics'
                });
            }
        }

        // Audience Score
        const audienceScoreElem = $('rt-text[slot="audienceScore"]');
        if (audienceScoreElem.length) {
            const scoreText = audienceScoreElem.first().text().trim();
            const scoreValue = parseInt(scoreText, 10);
            if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 100) {
                ratings.push({
                    source: 'RT Users',
                    value: `${scoreValue}%`,
                    type: 'Audience'
                });
            }
        }

        // Fallback check if no scores found
        if (ratings.length === 0) {
            logger.debug(`[${PROVIDER_NAME}] No scores found in DOM structure for ${url}`);
        }

        return ratings;
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] DOM scraping error for ${url}: ${error.message}`);
        return [];
    }
}

// Update the JSON-LD parser to handle percentage values
function parseJsonLdRatings(jsonData) {
    const ratings = [];

    try {
        // Handle percentage values in JSON-LD
        const parsePercentage = (value) => {
            if (typeof value === 'string') {
                return parseInt(value.replace('%', ''), 10);
            }
            return Math.round(Number(value) * 100);
        };

        if (jsonData.aggregateRating) {
            const value = parsePercentage(jsonData.aggregateRating.ratingValue);
            if (!isNaN(value) && value >= 0 && value <= 100) {
                ratings.push({
                    source: 'RT',
                    value: `${value}/100`,
                    type: 'Critics'
                });
            }
        }

        // Additional check for audienceScore
        if (jsonData.audience && jsonData.audience.audienceScore) {
            const audienceValue = parsePercentage(jsonData.audience.audienceScore);
            if (!isNaN(audienceValue) && audienceValue >= 0 && audienceValue <= 100) {
                ratings.push({
                    source: 'RT Users',
                    value: `${audienceValue}/100`,
                    type: 'Audience'
                });
            }
        }
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Error parsing JSON-LD data: ${error.message}`);
    }

    return ratings;
}

function scrapeRottenTomatoesPage(htmlContent, url) {
    try {
        const $ = cheerio.load(htmlContent);
        const ratings = [];

        // First try JSON-LD parsing
        const jsonLdScripts = $('script[type="application/ld+json"]');
        jsonLdScripts.each((i, el) => {
            try {
                const jsonData = JSON.parse($(el).html());
                const result = parseJsonLdRatings(jsonData);
                // console.log(result);
                if (result.length > 0) ratings.push(...result);
            } catch (error) {
                logger.debug(`[${PROVIDER_NAME}] Error parsing JSON-LD script #${i + 1}: ${error.message}`);
            }
        });

        // Fall back to DOM scraping if no ratings found
        if (ratings.length === 0) {
            const domRatings = scrapeDomRatings($, url);
            ratings.push(...domRatings);
        }

        // Deduplicate and validate
        const uniqueRatings = [];
        const seenSources = new Set();

        // console.dir(ratings);

        for (const rating of ratings) {
            if (!seenSources.has(rating.source)) {
                seenSources.add(rating.source);
                uniqueRatings.push({
                    source: rating.source,
                    value: rating.value,
                    url
                });
            }
        }

        return uniqueRatings.length > 0 ? uniqueRatings : null;
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] General scraping error for ${url}: ${error.message}`);
        return null;
    }
}

async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Missing title`);
        return null;
    }

    if (!BASE_URL) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Base URL not configured`);
        return null;
    }

    const targetUrl = getRottenTomatoesUrl(streamInfo.name, type);
    if (!targetUrl) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Invalid URL for "${streamInfo.name}"`);
        return null;
    }

    logger.debug(`[${PROVIDER_NAME}] Fetching ratings for ${imdbId} from ${targetUrl}`);

    try {
        const response = await getPage(targetUrl, PROVIDER_NAME, {
            headers: {
                'Referer': BASE_URL,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response || response.status !== 200) {
            if (response?.status === 404) {
                logger.debug(`[${PROVIDER_NAME}] 404 Not Found for ${targetUrl}`);
            }
            return null;
        }

        const ratings = scrapeRottenTomatoesPage(response.data, targetUrl);

        if (!ratings) {
            logger.debug(`[${PROVIDER_NAME}] No valid ratings found for ${imdbId}`);
            return null;
        }

        logger.info(`[${PROVIDER_NAME}] Found ${ratings.length} ratings for ${imdbId}`);
        return ratings;
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Error fetching ratings for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};