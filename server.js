const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 7000;

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
});
