const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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

// Check if urls.json has a valid URL
const urlsPath = path.join(__dirname, "urls.json");

function readUrls() {
    try {
        if (!fs.existsSync(urlsPath)) return {};
        const data = JSON.parse(fs.readFileSync(urlsPath, "utf8"));
        return data && typeof data === "object" ? data : {};
    } catch (e) {
        console.error("Error reading urls.json", e);
        return {};
    }
}

// Read on every request so changes from /configure apply without a restart
function getStreamUrl() {
    const url = readUrls().url;
    return typeof url === "string" ? url.trim() : "";
}

const hasUrl = getStreamUrl() !== "";

const BASE_CATALOG_DEFS = [
    {
        name: "New Releases",
        catalog: {
            type: "movie",
            id: "malluflix_catalog",
            name: "MalluFlix New Releases",
            extra: [{ name: "skip" }]
        }
    },
    {
        name: "OTT Released",
        catalog: {
            type: "movie",
            id: "malluflix_ott",
            name: "MalluFlix OTT Released",
            extra: [{ name: "skip" }]
        }
    },
    {
        name: "Future Releases",
        catalog: {
            type: "movie",
            id: "malluflix_future",
            name: "MalluFlix Future Releases",
            extra: [{ name: "skip" }]
        }
    }
];

const BASE_CATALOGS = BASE_CATALOG_DEFS.map(def => def.catalog);
const BASE_CATALOG_BY_NAME = new Map(BASE_CATALOG_DEFS.map(def => [def.name, def.catalog]));

// Everything the manifest can expose as a catalog, in default order
const CATALOG_NAMES = [
    ...BASE_CATALOG_DEFS.map(def => def.name),
    ...Object.keys(GENRES)
];

const STREAMS_CATALOG = {
    type: "movie",
    id: "malluflix_streams",
    name: "MalluFlix Direct Streams",
    extra: [{ name: "skip" }]
};

function genreCatalog(name) {
    return {
        type: "movie",
        id: `malluflix_genre_${name.toLowerCase().replace(/\s+/g, '_')}`,
        name: `MalluFlix ${name}`,
        extra: [{ name: "skip" }]
    };
}

function catalogForName(name) {
    if (BASE_CATALOG_BY_NAME.has(name)) return BASE_CATALOG_BY_NAME.get(name);
    if (Object.prototype.hasOwnProperty.call(GENRES, name)) return genreCatalog(name);
    return null;
}

/*
 * Builds the manifest. With a selection only those catalogs are exposed, in the
 * given order; without one the default catalog list is used.
 */
function buildManifest(catalogNames) {
    const hasSelection = Array.isArray(catalogNames) && catalogNames.length > 0;

    const catalogs = hasSelection
        ? catalogNames.map(catalogForName).filter(Boolean)
        : [
            ...BASE_CATALOGS,
            ...Object.keys(GENRES).map(genreCatalog),
            ...(hasUrl ? [STREAMS_CATALOG] : [])
        ];

    return {
        id: "org.mallu.flix",
        version: "3.0.0",
        name: "MalluFlix",
        description: "Malayalam movie catalog using TMDB discovery + Cinemeta compatibility",
        logo: "https://forzayt.github.io/MalluFlix_stremio_addon/images/logo.jpg",
        resources: ["catalog", "meta", "stream"],
        types: ["movie"],
        catalogs,
        idPrefixes: ["tt", "malluflix_"]
    };
}

const manifest = buildManifest();

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
    if (id === "malluflix_streams") {
        if (!getStreamUrl()) return { metas: [] };
        return {
            metas: [{
                id: "malluflix_direct_stream",
                type: "movie",
                name: "MalluFlix Direct Stream",
                poster: "https://forzayt.github.io/MalluFlix_stremio_addon/images/logo.jpg",
                description: "Direct play from urls.json"
            }]
        };
    }

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

    if (id === "malluflix_direct_stream") {
        return {
            meta: {
                id: "malluflix_direct_stream",
                type: "movie",
                name: "MalluFlix Direct Stream",
                poster: "https://forzayt.github.io/MalluFlix_stremio_addon/images/logo.jpg",
                description: "Direct play from urls.json",
                background: "https://forzayt.github.io/MalluFlix_stremio_addon/images/logo.jpg"
            }
        };
    }

    const data = await fetchWithCache(
        `https://v3-cinemeta.strem.io/meta/movie/${id}.json`
    );
    return { meta: data.meta || data };
});

/* Stream Handler */
builder.defineStreamHandler(async ({ type, id }) => {
    if (type !== "movie" || id !== "malluflix_direct_stream") return { streams: [] };

    const url = getStreamUrl();
    if (url) {
        return {
            streams: [{
                title: "MalluFlix Direct Stream",
                url
            }]
        };
    }

    return { streams: [] };
});

const addonInterface = builder.getInterface();
addonInterface.buildManifest = buildManifest;
addonInterface.GENRES = GENRES;
addonInterface.CATALOG_NAMES = CATALOG_NAMES;

module.exports = addonInterface;
