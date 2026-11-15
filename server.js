const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 7000;
const URLS_PATH = path.join(__dirname, "urls.json");

app.use(express.json({ limit: "16kb" }));

function readConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(URLS_PATH, "utf8"));
        return { url: typeof parsed.url === "string" ? parsed.url : "" };
    } catch (err) {
        return { url: "" };
    }
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

// Configuration page for the direct stream URL
app.get("/configure", (req, res) => {
    res.sendFile(path.join(__dirname, "configure.html"));
});

app.get("/api/config", (req, res) => {
    res.json(readConfig());
});

app.post("/api/config", (req, res) => {
    const url = normalizeUrl(req.body && req.body.url);

    if (url === null) {
        return res.status(400).json({ error: "Enter a valid http:// or https:// stream URL." });
    }

    try {
        fs.writeFileSync(URLS_PATH, JSON.stringify({ url }, null, 4) + "\n", "utf8");
        res.json({ url });
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
