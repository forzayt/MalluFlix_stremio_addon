const { createEmbedSource } = require("./embed");

// https://vixsrc.to/ - uses lowercase "autoplay" plus primaryColor/secondaryColor
module.exports = createEmbedSource({
    id: "vixsrc",
    name: "VixSrc",
    movieBaseUrl: process.env.VIXSRC_MOVIE_BASE_URL || "https://vixsrc.to/movie",
    seriesBaseUrl: process.env.VIXSRC_TV_BASE_URL || "https://vixsrc.to/tv",
    movieParams: { autoplay: "true" },
    seriesParams: { autoplay: "true" }
});
