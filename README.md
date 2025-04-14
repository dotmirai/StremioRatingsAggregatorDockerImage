# Stremio Ratings Aggregator Addon

This Stremio addon fetches ratings from various sources (IMDb, TMDb, Metacritic, Common Sense Media, CringeMDB) and displays them aggregated within the Stremio interface.

## Features

* Fetches ratings using the TMDb API.
* Scrapes ratings from IMDb, Metacritic, Common Sense Media, and CringeMDB.
* Uses Redis for caching fetched ratings to reduce load and improve speed.
* Displays aggregated ratings directly in the Stremio stream list for movies and series.
* Structured and maintainable Node.js codebase.

## Prerequisites

* [Node.js](https://nodejs.org/) (v16 or later recommended)
* [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
* [Redis](https://redis.io/) (running locally or accessible via URL)
* A [TMDb API Key](https://www.themoviedb.org/settings/api) (free)

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd your-stremio-addon-ratings
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables:**
    * Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    * Edit the `.env` file with your actual details:
        * `PORT`: The port the addon server will run on (default: 61262).
        * `TMDB_API_KEY`: Your TMDb API key (v3 auth). **Required.**
        * `REDIS_URL`: The connection URL for your Redis instance (e.g., `redis://localhost:6379`). **Required for caching.**
        * `CACHE_TTL_SECONDS`: How long cache entries should last (default: 86400 = 24 hours).
        * `LOG_LEVEL`: Optional log level (`debug`, `info`, `warn`, `error`). Default is `info`.

4.  **Ensure Redis is running:**
    * If running Redis locally, start the Redis server.
    * If using a cloud provider, ensure it's accessible from where you run the addon.

## Running the Addon

* **Development Mode (with automatic restarting):**
    ```bash
    npm run dev
    ```
    This uses `nodemon` to watch for file changes and restart the server.

* **Production Mode:**
    ```bash
    npm start
    ```

Once running, the console will output the addon's manifest URL (e.g., `http://127.0.0.1:61262/manifest.json`).

## Adding to Stremio

1.  Open Stremio.
2.  Go to the Addons section.
3.  In the search bar at the top, paste the manifest URL provided when you started the addon (e.g., `http://127.0.0.1:61262/manifest.json`).
4.  Click "Install".

Now, when you view the details page for a movie or series, you should see a "stream" item titled "📊 Ratings & Info" containing the aggregated ratings.

## Notes

* **Scraping Fragility:** Web scraping (used for IMDb, Metacritic, etc.) can break if the websites change their structure. This addon attempts to use reasonably stable selectors, but updates may be required.
* **Rate Limits:** Be mindful of potential rate limits when scraping websites frequently. The Redis cache significantly mitigates this. Respect TMDb's API rate limits.
* **Error Handling:** The addon includes basic error handling, but complex scraping or network issues might still occur. Check the console logs for details.
* **Placeholders:** Letterboxd and Rotten Tomatoes providers are included as placeholders but are not implemented due to scraping difficulty.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.