const ratingService = require('../services/ratingService');
const logger = require('../utils/logger');
const config = require('../config');
const { getEmojiForSource } = require('../utils/emojiMapper');

// Format stream description
function formatRatingsCard(ratings) {
    const lines = ["───────────────"];

    // Common Sense (child-safety first)
    const commonSense = ratings.find(r => r.source === 'Common Sense');
    if (commonSense) {
        lines.push(`${getEmojiForSource(commonSense.source)} ${commonSense.value}`);
    }

    // Standard ratings
    ratings
        .filter(r => ['IMDb', 'TMDb', 'MC', 'MC Users', 'RT', 'RT Users'].includes(r.source))
        .sort((a, b) => {
            const order = ['IMDb', 'TMDb', 'MC', 'MC Users', 'RT', 'RT Users'];
            return order.indexOf(a.source) - order.indexOf(b.source);
        })
        .forEach(rating => {
            lines.push(`${getEmojiForSource(rating.source)} ${rating.source.padEnd(9)}: ${rating.value}`);
        });

    // CringeMDB + Certification
    const cringe = ratings.find(r => r.source === 'CringeMDB' || r.source === 'Certification');
    if (cringe) {
        cringe.value.split('\n').forEach(line => {
            if (line.trim()) lines.push(line.trim());
        });
    }

    lines.push("───────────────");
    return lines.join('\n');
}

async function streamHandler({ type, id }) {
    logger.info(`Received stream request for: type=${type}, id=${id}`);

    if (!id || !id.startsWith('tt')) {
        logger.warn(`Invalid or unsupported ID format: ${id}`);
        return { streams: [] };
    }

    try {
        const ratings = await ratingService.getRatings(type, id);

        if (!ratings?.length) {
            logger.info(`No ratings found for: ${id}`);
            return { streams: [] };
        }

        const stream = {
            name: "🎯 Ratings Aggregator",
            description: formatRatingsCard(ratings),
            externalUrl: `${config.sources.imdbBaseUrl}/title/${id.split(':')[0]}/`,
            behaviorHints: {
                notWebReady: true,
                // bingeGroup: `ratings-${id}`
            },
            // type: "other"
        };

        logger.info(`Returning 1 rating stream for ${id}`);
        return { streams: [stream] };

    } catch (error) {
        logger.error(`Error in streamHandler for ${id}: ${error.message}`, error);
        return { streams: [] };
    }
}

module.exports = streamHandler;
