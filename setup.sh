#!/bin/bash

mkdir -p \
  node_modules \
  src/{config,services,providers,cache,handlers,utils}

# Create core files
touch src/addon.js
touch src/server.js

# Config
touch src/config/index.js

# Services
touch src/services/ratingService.js

# Providers
touch src/providers/{index.js,tmdb.js,imdb.js,metacritic.js,commonsense.js,cringemdb.js,letterboxd.js,rottenTomatoes.js}

# Cache
touch src/cache/redisClient.js

# Handlers
touch src/handlers/streamHandler.js

# Utils
touch src/utils/{getTmdbId.js,getStreamName.js,logger.js}

# Root files
touch .env .env.example .gitignore eslint.config.mjs package.json README.md
