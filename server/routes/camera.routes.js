/**
 * ======================================================
 * camera.routes.js 
 * ======================================================
 *
 * Responsibilities:
 * - Proxy MJPEG stream from Python camera service
 * - Trigger still image capture (server-side)
 *
 * Design:
 * - Node acts as proxy/boundary layer
 * - Python owns camera (pypylon)
 * - Frontend never interacts with hardware directly
 */

const express = require("express");
const http = require("http");

const fetch = require("node-fetch"); // kept explicit
const photosService = require("../services/photos.service");

const { CAMERA_SERVER_BASE } = require("../config/env");

const router = express.Router();

/* ======================================================
   INTERNAL HELPERS
====================================================== */

/**
 * Parse base URL into HTTP request options.
 * (Keeps consistent usage across endpoints)
 */
function getCameraRequestOptions(path, method, headers = {}) {
  const url = new URL(CAMERA_SERVER_BASE);

  return {
    hostname: url.hostname,
    port: url.port,
    path,
    method,
    headers
  };
}

/* ======================================================
   LIVE MJPEG STREAM (PROXY)
====================================================== */

router.get("/stream", (req, res) => {

  const options = getCameraRequestOptions("/stream", "GET", req.headers);

  const proxyReq = http.request(options, pyRes => {
    res.writeHead(pyRes.statusCode, pyRes.headers);
    pyRes.pipe(res);
  });

  proxyReq.on("error", err => {
    console.error("[Camera] Stream proxy error:", err);
    res.sendStatus(500);
  });

  proxyReq.end();
});

/* ======================================================
   STILL IMAGE CAPTURE (SERVER-SIDE)
====================================================== */

router.post("/capture", async (req, res) => {
  try {
    const response = await fetch(`${CAMERA_SERVER_BASE}/capture`, {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Camera capture failed");
    }

    const { image } = await response.json();

    if (!image) {
      throw new Error("No image data returned from camera");
    }

    // Convert hex → base64 for frontend-compatible format
    const base64 =
      "data:image/png;base64," +
      Buffer.from(image, "hex").toString("base64");

    const result = await photosService.savePhoto(base64);

    res.json(result);

  } catch (err) {
    console.error("[Camera Capture]", err.message);

    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;
