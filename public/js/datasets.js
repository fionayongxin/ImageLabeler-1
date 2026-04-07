const gallery = document.getElementById("gallery");
const statusBox = document.getElementById("datasetStatus");
const loadBtn = document.getElementById("loadBtn");

loadBtn.onclick = async () => {
  const station = document.getElementById("station").value;
  const process = document.getElementById("process").value;

  gallery.innerHTML = "";
  statusBox.textContent = "Loading images...";

  try {
    const res = await fetch(
      `/api/dataset/images?station=${encodeURIComponent(station)}&process=${encodeURIComponent(process)}`
    );

    const images = await res.json();

    if (!Array.isArray(images) || images.length === 0) {
      statusBox.textContent = "No images found for this dataset.";
      return;
    }

    statusBox.textContent = `${images.length} images loaded`;

    images.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";              // ✅ important
      img.title = "Click to view full size";
      img.onclick = () => window.open(src, "_blank");
      gallery.appendChild(img);
    });

  } catch (err) {
    console.error(err);
    statusBox.textContent = "Failed to load images.";
  }
};
