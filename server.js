const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const streamSources = require("./sources");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 7000;
const URLS_PATH = path.join(__dirname, "urls.json");
const CATALOG_NAMES = addonInterface.CATALOG_NAMES;
const CATALOG_BY_LOWER = new Map(CATALOG_NAMES.map((name) => [name.toLowerCase(), name]));

app.use(express.json({ limit: "16kb" }));

// Maps names loosely (any casing, unknown ones dropped) while keeping the given order
function toCatalogSelection(values) {
    const names = [];

    for (const value of values) {
        if (typeof value !== "string") continue;
        const name = CATALOG_BY_LOWER.get(value.trim().toLowerCase());
        if (name && !names.includes(name)) names.push(name);
    }

    return names;
}

function readConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(URLS_PATH, "utf8"));
        return {
            url: typeof parsed.url === "string" ? parsed.url : "",
            genres: Array.isArray(parsed.genres) ? toCatalogSelection(parsed.genres) : []
        };
    } catch (err) {
        return { url: "", genres: [] };
    }
}

function writeConfig(config) {
    fs.writeFileSync(URLS_PATH, JSON.stringify(config, null, 4) + "\n", "utf8");
}

// Returns the trimmed URL, "" to clear it, or null when it is not a valid http(s) URL
function normalizeUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    } catch (err) {
        return null;
    }

    return trimmed;
}

// Catalog selection from the query string, falling back to the saved configuration
function resolveCatalogSelection(param) {
    if (param === undefined) {
        const saved = readConfig().genres;
        return saved.length ? saved : null;
    }

    const names = toCatalogSelection(String(param).split(","));
    return names.length ? names : null;
}

// Manifest route that exposes only the selected catalogs
app.get("/manifest.json", (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-store");

    const selection = resolveCatalogSelection(req.query.genres);

    if (!selection) {
        return res.json(addonInterface.manifest);
    }

    res.json(addonInterface.buildManifest(selection));
});

// Configuration page for catalogs and the direct stream URL
app.get("/configure", (req, res) => {
    res.sendFile(path.join(__dirname, "configure.html"));
});

app.get("/api/catalogs", (req, res) => {
    res.json(CATALOG_NAMES);
});

// Every stream source that answers for all titles, not just the catalogs
app.get("/api/sources", (req, res) => {
    res.json(streamSources.map((source) => ({
        id: source.id,
        name: source.name,
        movie: source.hosts.movie,
        series: source.hosts.series
    })));
});

app.get("/api/config", (req, res) => {
    res.json(readConfig());
});

app.post("/api/config", (req, res) => {
    const body = req.body || {};
    const current = readConfig();

    let url = current.url;
    if (body.url !== undefined) {
        const normalized = normalizeUrl(body.url);
        if (normalized === null) {
            return res.status(400).json({ error: "Enter a valid http:// or https:// stream URL." });
        }
        url = normalized;
    }

    if (body.genres !== undefined && !Array.isArray(body.genres)) {
        return res.status(400).json({ error: "Genres must be a list of supported catalog names." });
    }

    const genres = body.genres === undefined ? current.genres : toCatalogSelection(body.genres);

    try {
        writeConfig({ url, genres });
        res.json({ url, genres });
    } catch (err) {
        console.error("Error writing urls.json", err);
        res.status(500).json({ error: "Could not save the configuration on the server." });
    }
});

// List the loader animations so the landing page can loop through them dynamically
app.get("/loaders/index.json", (req, res) => {
    fs.readdir(path.join(__dirname, "loaders"), (err, files) => {
        if (err) {
            return res.json([]);
        }
        res.json(files.filter((file) => file.toLowerCase().endsWith(".json")).sort());
    });
});

// Serve static files (like bg.jpg) from the current directory
app.use(express.static(path.join(__dirname)));

// Use the Stremio Addon SDK router
app.use("/", getRouter(addonInterface));

// Landing page for the root URL
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
    console.log(`Addon active on port ${port}`);
    console.log(`http://127.0.0.1:${port}/manifest.json`);
    console.log(`http://127.0.0.1:${port}/configure`);
});
