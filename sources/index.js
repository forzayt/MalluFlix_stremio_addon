/*
 * Stream sources. Every file exports:
 *   { id, name, hosts, getStreams({ type, id }) -> Promise<stream[]> }
 * Add new sources here to make them available for every title, not just the
 * MalluFlix catalogs.
 */

module.exports = [
    require("./vidcore"),
    require("./vidfast"),
    require("./vidnest"),
    require("./vidsrc"),
    require("./vixsrc")
];
