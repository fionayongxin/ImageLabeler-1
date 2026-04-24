/**
 * ======================================================
 * camera.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - Proxy Basler camera operations to Python camera service
 *   • Live MJPEG preview
 *   • Still image capture
 *
 * IMPORTANT:
 * - Node NEVER opens the camera
 * - Python (basler_stream.py) is the sole camera owner
 * ======================================================
 */

const express = require("express");
const http = require("http");

const router = express.Router(); // ✅ THIS WAS MISSING

/* ======================================================
   LIVE MJPEG STREAM
   ------------------------------------------------------
   Browser → /api/camera/stream
   Node    → proxies to http://127.0.0.1:8001/stream
====================================================== */

router.get("/stream", (req, res) => {
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: 8001,
      path: "/stream",
      method: "GET",
      headers: req.headers
    },
    pyRes => {
      res.writeHead(pyRes.statusCode, pyRes.headers);
      pyRes.pipe(res);
    }
  );

  proxyReq.on("error", err => {
    console.error("[Camera] Stream proxy error:", err);
    res.sendStatus(500);
  });

  proxyReq.end();
});

/* ======================================================
   STILL IMAGE CAPTURE
   ------------------------------------------------------
   Browser → /api/camera/capture
   Node    → proxies to http://127.0.0.1:8001/capture
   Python  → saves latest frame
====================================================== */

router.post("/capture", (req, res) => {
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: 8001,
      path: "/capture",
      method: "POST"
    },
    pyRes => {
      let body = "";
      pyRes.on("data", chunk => (body += chunk));
      pyRes.on("end", () => {
        res.status(pyRes.statusCode).send(body);
      });
    }
  );

  proxyReq.on("error", err => {
    console.error("[Camera] Capture proxy error:", err);
    res.sendStatus(500);
  });

  proxyReq.end();
});

module.exports = router;