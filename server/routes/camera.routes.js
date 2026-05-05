const express = require("express");
const http = require("http");
const photosService = require("../services/photos.service");

const router = express.Router();

/* ======================================================
   LIVE MJPEG STREAM
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
   STILL IMAGE CAPTURE (UNIFIED)
====================================================== */

router.post("/capture", async (req, res) => {
  try {
    const pyRes = await fetch("http://127.0.0.1:8001/capture", {
      method: "POST"
    });

    if (!pyRes.ok) {
      throw new Error("Camera capture failed");
    }

    const { image } = await pyRes.json();
    if (!image) {
      throw new Error("No image data returned from camera");
    }

    const base64 =
      "data:image/png;base64," +
      Buffer.from(image, "hex").toString("base64");

    const result = await photosService.savePhoto(base64);
    res.json(result);

  } catch (err) {
    console.error("[Camera Capture]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
