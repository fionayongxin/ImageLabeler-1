/**
 * Server bootstrap only.
 */
const express = require("express");
const path = require("path");
const { SERVER_PORT } = require("./config/env");

const app = express();

app.use(express.json({ limit: "10mb" }));

// static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/photos", express.static(path.join(__dirname, "photos")));
app.use("/datasets", express.static(path.join(__dirname, "..", "datasets")));
app.use("/training", express.static(path.join(__dirname, "training")));

// routes
app.use("/api/photos", require("./routes/photos.routes"));
app.use("/api/datasets", require("./routes/datasets.routes"));
app.use("/api/yolo", require("./routes/yolo.routes"));
app.use("/api/train", require("./routes/training.routes"));
app.use("/api/experiments", require("./routes/experiments.routes"));
app.use("/api/inference", require("./routes/inference.routes"));
app.use("/api/system", require("./routes/system.routes"));
app.use("/", require("./routes/ui.routes"));

app.listen(SERVER_PORT, () => {
  console.log(`Server running on http://localhost:${SERVER_PORT}`);
});