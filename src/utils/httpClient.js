// utils/httpClient.js
const axios = require('axios');
const config = require('../config');
const logger = require('./logger'); // Assuming logger is also in utils

// Create a single Axios instance with common configurations
const instance = axios.create({
    timeout: config.http.requestTimeoutMs || 10000, // Use a config value
    headers: {
        'User-Agent': config.userAgent,
        'Accept-Language': 'en-US,en;q=0.9', // Common language preference
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', // Common accept header
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    },
    // Important for scraping: Don't throw errors on non-2xx status codes like 404
    // We will check the status code manually in the calling function
    validateStatus: function (status) {
        return status >= 200 && status < 600; // Accept any status code, handle specific ones later
    },
});

/**
 * Performs a GET request using the shared Axios instance.
 * Handles basic logging and returns the Axios response object.
 * Throws error only on network/timeout issues, not on HTTP status codes.
 * @param {string} url - The URL to fetch.
 * @param {string} providerName - Name of the calling provider for logging.
 * @param {object} [requestConfig={}] - Optional additional Axios config for this request.
 * @returns {Promise<import('axios').AxiosResponse|null>} - The Axios response object or null on network/config error.
 */
async function getPage(url, providerName, requestConfig = {}) {
    try {
        logger.debug(`[${providerName}] HTTP GET: ${url}`);
        const response = await instance.get(url, requestConfig);

        // Log non-200 responses
        if (response.status !== 200) {
            // Specific logging for 404 is helpful
            if (response.status === 404) {
                logger.warn(`[${providerName}] HTTP GET failed: ${response.status} Not Found - ${url}`);
            } else {
                logger.warn(`[${providerName}] HTTP GET failed: ${response.status} ${response.statusText} - ${url}`);
            }
        }

        return response; // Return the full response object
    } catch (error) {
        // Handle network errors, timeouts, DNS issues, etc. (not HTTP status errors due to validateStatus)
        logger.error(`[${providerName}] Network Error for ${url}: ${error.message}`);
        return null; // Return null on network/config errors
    }
}

module.exports = {
    getPage,
    // Export the instance if direct access is needed elsewhere (less common)
    // axiosInstance: instance
};