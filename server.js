const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Ensure photos folder exists
const photosDir = path.join(__dirname, "photos");
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir);
}

app.use("/photos", express.static(path.join(__dirname, "photos")));

// API to save photo
app.post("/api/save-photo", (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: "No image data" });
  }

  const base64Data = image.replace(/^data:image\/png;base64,/, "");
  const filename = `photo_${Date.now()}.png`;
  const filepath = path.join(photosDir, filename);

  fs.writeFile(filepath, base64Data, "base64", err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    res.json({ status: "ok", filename });
  });
});

app.get("/api/photos", (req, res) => {
  fs.readdir(photosDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read photos" });
    }

    const images = files
      .filter(f => f.endsWith(".png"))
      .sort((a, b) => b.localeCompare(a)); // newest first

    res.json(images);
  });
});


app.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
