const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");

const TMDB_KEY = "b8e31efed6de570178942a39601e84b0";

const GENRES = {
    "Action": 28,
    "Adventure": 12,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Family": 10751,
    "Fantasy": 14,
    "History": 36,
    "Horror": 27,
    "Music": 10402,
    "Mystery": 9648,
    "Romance": 10749,
    "Science Fiction": 878,
    "Thriller": 53
};

const manifest = {
    id: "org.mallu.flix",
    version: "3.0.0",
    name: "MalluFlix",
    description: "Malayalam movie catalog using TMDB discovery + Cinemeta compatibility",
    logo: "https://forzayt.github.io/MalluFlix_stremio_addon/images/logo.jpg",
    resources: ["catalog", "meta"],
    types: ["movie"],
    catalogs: [
        {
            type: "movie",
            id: "malluflix_catalog",
            name: "MalluFlix New Releases",
            extra: [{ name: "search" }, { name: "skip" }]
        },
        {
            type: "movie",
            id: "malluflix_ott",
            name: "MalluFlix OTT Released",
            extra: [{ name: "search" }, { name: "skip" }]
        },
        {
            type: "movie",
            id: "malluflix_future",
            name: "MalluFlix Future Releases",
            extra: [{ name: "search" }, { name: "skip" }]
        },
        ...Object.keys(GENRES).map(name => ({
            type: "movie",
            id: `malluflix_genre_${name.toLowerCase().replace(/\s+/g, '_')}`,
            name: `MalluFlix ${name}`,
            extra: [{ name: "search" }, { name: "skip" }]
        }))
    ],
    idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const cache = new Map();

async function fetchWithCache(url, config = {}) {
    const key = url + JSON.stringify(config.params || {});
    const cached = cache.get(key);

    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
        console.log(`Cache hit for: ${url}`);
        return cached.data;
    }

    console.log(`Cache miss for: ${url}. Fetching...`);
    const response = await axios.get(url, config);
    cache.set(key, {
        data: response.data,
        timestamp: Date.now()
    });
    return response.data;
}

/* Convert TMDB → IMDb ID */
async function tmdbToImdb(tmdbId) {
    try {
        const data = await fetchWithCache(
            `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`,
            { params: { api_key: TMDB_KEY } }
        );
        return data.imdb_id;
    } catch {
        return null;
    }
}

/* Malayalam Catalog */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    const isGenreCatalog = id.startsWith("malluflix_genre_");
    if (type !== "movie" || (!["malluflix_catalog", "malluflix_ott", "malluflix_future"].includes(id) && !isGenreCatalog)) return { metas: [] };

    const skip = extra?.skip ? parseInt(extra.skip) : 0;
    const page = Math.round(skip / 20) + 1;
    const today = new Date().toISOString().split('T')[0];

    const params = {
        api_key: TMDB_KEY,
        with_original_language: "ml",
        sort_by: "primary_release_date.desc",
    };

    if (id === "malluflix_ott") {
        // Filter for Digital releases (4) in India
        params["release_date.lte"] = today;
        params.with_release_type = "4|5"; // 4 = Digital, 5 = Physical
        params.region = "IN";
        params.sort_by = "release_date.desc";
    } else if (id === "malluflix_future") {
        // Filter for Future releases (greater than today)
        params["primary_release_date.gte"] = today;
        params.sort_by = "primary_release_date.asc"; // Show soonest releases first
    } else if (isGenreCatalog) {
        // Extract genre name from ID and find corresponding ID
        const genreName = id.replace("malluflix_genre_", "");
        const genreId = Object.entries(GENRES).find(([name]) => name.toLowerCase().replace(/\s+/g, '_') === genreName)?.[1];
        
        if (genreId) {
            params["primary_release_date.lte"] = today;
            params.with_genres = genreId.toString();
            params.sort_by = "primary_release_date.desc";
        }
    } else {
        // Default: All Malayalam releases
        params["primary_release_date.lte"] = today;
        params.sort_by = "primary_release_date.desc";
    }

    // Fetch 3 pages to ensure sufficient content
    const promises = [page, page + 1, page + 2].map(p =>
        fetchWithCache("https://api.themoviedb.org/3/discover/movie", {
            params: { ...params, page: p }
        })
    );

    const responses = await Promise.all(promises);
    const results = responses.flatMap(r => r.results || []);

    // Process items in chunks to avoid hitting API rate limits (429)
    const batchSize = 5;
    const validMetas = [];

    for (let i = 0; i < results.length; i += batchSize) {
        const chunk = results.slice(i, i + batchSize);
        const chunkPromises = chunk.map(async (m) => {
            const imdb = await tmdbToImdb(m.id);
            if (!imdb) return null;
            return {
                id: imdb,
                type: "movie",
                name: m.title,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                description: m.overview
            };
        });

        const chunkResults = await Promise.all(chunkPromises);
        validMetas.push(...chunkResults.filter(m => m !== null));
    }

    return { metas: validMetas };
});

/* Cinemeta Metadata */
builder.defineMetaHandler(async ({ type, id }) => {
    if (type !== "movie") return { meta: null };

    const data = await fetchWithCache(
        `https://v3-cinemeta.strem.io/meta/movie/${id}.json`
    );
    return { meta: data.meta || data };
});

module.exports = builder.getInterface();
