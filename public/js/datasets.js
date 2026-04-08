const gallery = document.getElementById("gallery");
const statusBox = document.getElementById("datasetStatus");
const loadBtn = document.getElementById("loadBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const pageCounter = document.getElementById("pageCounter");

const PAGE_SIZE = 50;
let allImages = [];
let currentPage = 0;

// ✅ POC hard-coded values
const STATIONS = ["station_01", "station_02"];
const PROCESSES = ["final_inspection", "pre_inspection"];

function renderNextPage() {
  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, allImages.length);

  const pageImages = allImages.slice(start, end);

  pageImages.forEach(({ src, title }) => {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    img.title = title;
    img.onclick = () => window.open(src, "_blank");
    gallery.appendChild(img);
  });

  currentPage++;

  // ✅ page counter
  pageCounter.textContent = `${end} / ${allImages.length} images`;

  if (end >= allImages.length) {
    loadMoreBtn.style.display = "none";
  }
}

loadBtn.onclick = async () => {
  const station = document.getElementById("station").value;
  const process = document.getElementById("process").value;

  pageCounter.textContent = "";
  currentPage = 0;

  gallery.innerHTML = "";
  statusBox.textContent = "Loading images...";
  loadMoreBtn.style.display = "none";

  allImages = [];
  currentPage = 0;

  const stationsToLoad = station === "ALL" ? STATIONS : [station];
  const processesToLoad = process === "ALL" ? PROCESSES : [process];

  try {
    for (const st of stationsToLoad) {
      for (const pr of processesToLoad) {
        const res = await fetch(
          `/api/dataset/images?station=${encodeURIComponent(st)}&process=${encodeURIComponent(pr)}`
        );

        const images = await res.json();
        if (!Array.isArray(images)) continue;

        images.forEach(src => {
          allImages.push({
            src,
            title: `${st} / ${pr}`
          });
        });
      }
    }

    if (allImages.length === 0) {
      statusBox.textContent = "No images found.";
      return;
    }

    statusBox.textContent = `${allImages.length} images found`;
    loadMoreBtn.style.display = "inline-block";

    renderNextPage(); // ✅ FIRST PAGE ONLY

  } catch (err) {
    console.error(err);
    statusBox.textContent = "Failed to load images.";
  }
};

loadMoreBtn.onclick = renderNextPage;
