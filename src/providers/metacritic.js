const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const getStreamNameAndYear = require('../utils/getStreamName'); // Use updated utility

const PROVIDER_NAME = 'Metacritic';

// Helper to generate Metacritic search URL (more reliable than guessing direct URL)
function getMetacriticSearchUrl(title, type) {
    const mediaType = type === 'series' ? 'tv' : 'movie';
    const query = encodeURIComponent(title);
    // Using search might be more robust than directly constructing the URL
    return `${config.sources.metacriticBaseUrl}/search/${mediaType}/${query}/results`;
    // Direct URL construction (less reliable):
    // const formattedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    // return `${config.sources.metacriticBaseUrl}/${mediaType}/${formattedTitle}`;
}

// Helper to find the correct result link from search results
async function findCorrectMetacriticUrl(searchUrl, titleToMatch, yearToMatch) {
    try {
        logger.debug(`${PROVIDER_NAME}: Searching Metacritic at ${searchUrl}`);
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);

        let bestMatchUrl = null;

        // Iterate through search results
        $('.result').each((_, el) => {
            const resultTitle = $(el).find('.product_title a').text().trim();
            const resultUrl = $(el).find('.product_title a').attr('href');
            const resultDate = $(el).find('.release_date span:last-child').text().trim(); // Get year if available
            const resultYear = resultDate ? new Date(resultDate).getFullYear().toString() : null;


            // Basic title match (case-insensitive)
            if (resultUrl && resultTitle.toLowerCase() === titleToMatch.toLowerCase()) {
                // If years match or one year is unknown, consider it a potential match
                if (!yearToMatch || !resultYear || yearToMatch === resultYear) {
                    bestMatchUrl = config.sources.metacriticBaseUrl + resultUrl; // Prepend base URL
                    logger.debug(`${PROVIDER_NAME}: Found potential match: "${resultTitle}" (${resultYear || 'N/A'}) at ${bestMatchUrl}`);
                    return false; // Stop iteration once a good match is found
                }
            }
        });

        if (bestMatchUrl) {
            logger.debug(`${PROVIDER_NAME}: Selected match URL: ${bestMatchUrl}`);
            return bestMatchUrl;
        } else {
            logger.warn(`${PROVIDER_NAME}: Could not find a matching title for "${titleToMatch}" (${yearToMatch || 'N/A'}) on search page.`);
            return null;
        }

    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Error searching Metacritic: ${error.message}`, { searchUrl });
        return null;
    }
}


async function scrapeMetacriticPage(url) {
    try {
        logger.debug(`${PROVIDER_NAME}: Scraping page ${url}`);
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const ratings = [];

        // --- Metascore (Critics) ---
        // Find the main score block which usually contains both critic and user scores
        const criticScoreElement = $('div.c-productScoreInfo').filter((i, el) => $(el).find('div.c-productScoreInfo_title:contains("Metascore")').length > 0).first();
        const criticScore = criticScoreElement.find('div.c-siteReviewScore > span').first().text().trim();
        // const criticDesc = criticScoreElement.find('div.c-productScoreInfo_description').text().trim(); // e.g., "Generally favorable reviews"
        // const criticCountText = criticScoreElement.find('div.c-productScoreInfo_reviewsTotal span').text().trim(); // e.g., "based on 38 Critic Reviews"
        // const criticCountMatch = criticCountText.match(/(\d+)\s+Critic/i);
        // const criticCount = criticCountMatch ? parseInt(criticCountMatch[1], 10) : null;

        if (criticScore && /^\d+$/.test(criticScore)) {
            logger.debug(`${PROVIDER_NAME}: Found Metascore ${criticScore}/100`);
            ratings.push({
                source: 'MC', // Keep short for display
                type: 'Critics',
                value: `${criticScore}/100`,
                // count: criticCount,
                url: url,
            });
        } else {
            logger.debug(`${PROVIDER_NAME}: Metascore not found or invalid on page.`);
        }

        // --- User Score ---
        const userScoreElement = $('div.c-productScoreInfo').filter((i, el) => $(el).find('div.c-productScoreInfo_title:contains("User Score")').length > 0).first();
        const userScore = userScoreElement.find('div.c-siteReviewScore > span').first().text().trim();
        // const userDesc = userScoreElement.find('div.c-productScoreInfo_description').text().trim(); // e.g., "Mixed or average reviews"
        // const userCountText = userScoreElement.find('div.c-productScoreInfo_reviewsTotal span').text().trim(); // e.g., "based on 1234 User Ratings"
        // const userCountMatch = userCountText.match(/(\d+)\s+User/i);
        // const userCount = userCountMatch ? parseInt(userCountMatch[1], 10) : null;

        // User score can be "tbd"
        if (userScore && /^\d+(\.\d+)?$/.test(userScore)) {
            logger.debug(`${PROVIDER_NAME}: Found User Score ${userScore}/10`);
            ratings.push({
                source: 'MC Users', // Distinguish from critic score
                type: 'Users',
                value: `${userScore}/10`,
                // count: userCount,
                url: url,
            });
        } else {
            logger.debug(`${PROVIDER_NAME}: User Score not found or invalid (value: ${userScore}) on page.`);
        }


        return ratings.length > 0 ? ratings : null;
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
    logger.debug(`${PROVIDER_NAME}: Fetching ratings for ${imdbId} (${type})`);

    try {
        // Get title and year needed for searching Metacritic
        const streamInfo = await getStreamNameAndYear(imdbId, type);
        if (!streamInfo?.name) {
            logger.warn(`${PROVIDER_NAME}: Cannot proceed without title/name for ${imdbId}.`);
            return null;
        }

        const searchUrl = getMetacriticSearchUrl(streamInfo.name, type);
        const targetUrl = await findCorrectMetacriticUrl(searchUrl, streamInfo.name, streamInfo.year);

        if (!targetUrl) {
            // Optional: Fallback to direct URL construction if search fails?
            // const directUrl = `${config.sources.metacriticBaseUrl}/${type === 'series' ? 'tv' : 'movie'}/${streamInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
            // logger.debug(`${PROVIDER_NAME}: Falling back to direct URL guess: ${directUrl}`);
            // targetUrl = directUrl;
            logger.warn(`${PROVIDER_NAME}: Could not find specific page URL for ${streamInfo.name}. Aborting.`);
            return null;
        }

        const ratings = await scrapeMetacriticPage(targetUrl);

        if (!ratings || ratings.length === 0) {
            logger.debug(`${PROVIDER_NAME}: No ratings found for ${streamInfo.name} at ${targetUrl}`);
            return null;
        }

        return ratings; // Return array of ratings (critic/user)
    } catch (error) {
        // Catch errors from getStreamNameAndYear or other unexpected issues
        logger.error(`${PROVIDER_NAME}: Unexpected error getting ratings for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};