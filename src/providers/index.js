// Export all provider modules for easy import in the service layer
module.exports = {
    tmdbProvider: require('./tmdb'),
    imdbProvider: require('./imdb'),
    metacriticProvider: require('./metacritic'),
    commonSenseProvider: require('./commonsense'),
    cringeMdbProvider: require('./cringemdb'),
    // letterboxdProvider: require('./letterboxd'), // Keep commented if not implemented
    // rottenTomatoesProvider: require('./rottenTomatoes'), // Keep commented if not implemented
};