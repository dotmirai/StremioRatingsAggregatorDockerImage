const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const getStreamNameAndYear = require('../utils/getStreamName'); // Use updated utility

const PROVIDER_NAME = 'Common Sense';


// Helper to generate Common Sense Media search URL
function getCommonSenseSearchUrl(title, type) {
    const mediaTypeFilter = type === 'series' ? 'tv' : 'movie';
    const query = encodeURIComponent(title);
    return `${config.sources.commonSenseBaseUrl}/search/${query}?type=${mediaTypeFilter}`;
}

// Helper to find the correct result link from search results
async function findCorrectCommonSenseUrl(searchUrl, titleToMatch) {
    try {
        logger.debug(`${PROVIDER_NAME}: Searching Common Sense at ${searchUrl}`);
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);

        let bestMatchUrl = null;

        // Find the first result item's link (Common Sense search is usually quite good)
        const firstResultLink = $('.search-results .entity-card a.entity-card__link').first();

        if (firstResultLink.length > 0) {
            const resultTitle = firstResultLink.find('.entity-card__title').text().trim();
            const resultUrl = firstResultLink.attr('href');

            // Basic check if title seems similar enough (case-insensitive partial match)
            if (resultUrl && resultTitle.toLowerCase().includes(titleToMatch.toLowerCase().substring(0, 10))) { // Match first 10 chars
                bestMatchUrl = config.sources.commonSenseBaseUrl + resultUrl;
                logger.debug(`${PROVIDER_NAME}: Found potential match "${resultTitle}" at ${bestMatchUrl}`);
            } else {
                logger.warn(`${PROVIDER_NAME}: First search result title "${resultTitle}" doesn't seem to match "${titleToMatch}". Using it anyway.`);
                bestMatchUrl = config.sources.commonSenseBaseUrl + resultUrl;
            }
        }

        if (bestMatchUrl) {
            return bestMatchUrl;
        } else {
            logger.warn(`${PROVIDER_NAME}: Could not find any search results for "${titleToMatch}" on search page.`);
            return null;
        }

    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Error searching Common Sense Media: ${error.message}`, { searchUrl });
        return null;
    }
}


async function scrapeCommonSensePage(url) {
    try {
        logger.debug(`${PROVIDER_NAME}: Scraping page ${url}`);
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // More specific selector for age rating (adjust if site structure changes)
        const reviewRatingDiv = $('div.review-rating').first();
        let ageRating = reviewRatingDiv.find('span.rating__age').first().text().trim();
        // Clean up "age 10+" -> "10+"
        ageRating = ageRating.replace(/^age\s*/i, '').trim();

        // Optional: Get star rating if needed
        // const totalStars = reviewRatingDiv.find('.rating__score .rating__icon--star').length;
        // const activeStars = reviewRatingDiv.find('.rating__score .rating__icon--star-active').length;
        // const starRatingValue = totalStars > 0 ? `${activeStars}/${totalStars} stars` : null;

        if (ageRating) {
            logger.debug(`${PROVIDER_NAME}: Found Age Rating: ${ageRating}`);
            return {
                source: PROVIDER_NAME,
                type: 'Age Rating',
                value: ageRating, // Just the age rating like "10+" or "13+"
                // value: starRatingValue ? `${ageRating} | ${starRatingValue}` : ageRating,
                url: url,
            };
        } else {
            logger.warn(`${PROVIDER_NAME}: Could not find age rating on page ${url}`);
            return null;
        }
    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`${PROVIDER_NAME}: Page not found (404) at ${url}`);
        } else if (error.response) {
            logger.error(`${PROVIDER_NAME}: HTTP Error scraping page ${url}: ${error.response.status}`);
        } else {
            logger.error(`${PROVIDER_NAME}: Network or parsing error scraping page ${url}: ${error.message}`);
        }
        return null;
    }
}


async function getRating(type, imdbId) {
    logger.debug(`${PROVIDER_NAME}: Fetching rating for ${imdbId} (${type})`);

    try {
        const streamInfo = await getStreamNameAndYear(imdbId, type);
        if (!streamInfo?.name) {
            logger.warn(`${PROVIDER_NAME}: Cannot proceed without title/name for ${imdbId}.`);
            return null;
        }

        const searchUrl = getCommonSenseSearchUrl(streamInfo.name, type);
        const targetUrl = await findCorrectCommonSenseUrl(searchUrl, streamInfo.name);
        

        if (!targetUrl) {
            logger.warn(`${PROVIDER_NAME}: Could not find specific page URL for ${streamInfo.name}.`);
            return null; // Could not find via search
        }

        const rating = await scrapeCommonSensePage(targetUrl);

        if (!rating) {
            logger.debug(`${PROVIDER_NAME}: No rating found for ${streamInfo.name} at ${targetUrl}`);
            return null;
        }

        return rating; // Return the single rating object
    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Unexpected error getting rating for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};