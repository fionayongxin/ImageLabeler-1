/* =========================================================
   ELEMENTS
========================================================= */
const gallery = document.getElementById("gallery");
const galleryWrapper = document.querySelector(".datasets-gallery-wrapper");
const statusBox = document.getElementById("datasetStatus");

const stationSelect = document.getElementById("station");
const processSelect = document.getElementById("process");

const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const pageInput = document.getElementById("pageInput");
const pageInfo = document.getElementById("pageInfo");
const goBtn = document.getElementById("goPage");

/* =========================================================
   STATE
========================================================= */
const PAGE_SIZE = 24;

let allImages = [];
let currentPage = 1;

/* ✅ POC hard-coded values */
const STATIONS = ["station_01", "station_02"];
const PROCESSES = ["final_inspection", "pre_inspection"];

/* =========================================================
   RENDER CURRENT PAGE (REPLACES CONTENT)
========================================================= */
function renderPage() {
  gallery.innerHTML = "";

  const fragment = document.createDocumentFragment();

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageImages = allImages.slice(start, start + PAGE_SIZE);

  pageImages.forEach(({ src, title }) => {
    const img = document.createElement("img");
    img.src = src;
    img.width = 180;
    img.height = 180;
    img.loading = "lazy";
    img.title = title;
    img.onclick = () => window.open(src, "_blank");
    fragment.appendChild(img);
  });

  gallery.appendChild(fragment);
  galleryWrapper.scrollTop = 0;
  updatePaginationUI();
}

/* =========================================================
   PAGINATION UI (SAME LOGIC AS EXPERIMENTS)
========================================================= */
function updatePaginationUI() {
  const totalPages = Math.max(1, Math.ceil(allImages.length / PAGE_SIZE));

  pageInfo.textContent = `of ${totalPages}`;
  pageInput.value = currentPage;
  pageInput.max = totalPages;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

/* =========================================================
   LOAD IMAGES (AUTO-TRIGGERED)
========================================================= */
async function loadImages() {
  const station = stationSelect.value;
  const process = processSelect.value;

  /* reset state */
  statusBox.textContent = "Loading images...";
  gallery.innerHTML = "";
  allImages = [];
  currentPage = 1;

  const stationsToLoad =
    station === "ALL" ? STATIONS : [station];
  const processesToLoad =
    process === "ALL" ? PROCESSES : [process];

  try {
    for (const st of stationsToLoad) {
      for (const pr of processesToLoad) {
        const res = await fetch(
          `/api/dataset/images?station=${encodeURIComponent(st)}&process=${encodeURIComponent(pr)}`
        );

        if (!res.ok) continue;

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
      updatePaginationUI();
      return;
    }

    statusBox.textContent = `${allImages.length} images found`;
    renderPage();

  } catch (err) {
    console.error(err);
    statusBox.textContent = "Failed to load images.";
  }
}

/* =========================================================
   PAGINATION CONTROLS
========================================================= */
prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(allImages.length / PAGE_SIZE);
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
  }
});

goBtn.addEventListener("click", () => {
  const target = Number(pageInput.value);
  const totalPages = Math.ceil(allImages.length / PAGE_SIZE);

  if (target >= 1 && target <= totalPages) {
    currentPage = target;
    renderPage();
  }
});

/* =========================================================
   AUTO-LOAD ON SELECTION CHANGE
========================================================= */
stationSelect.addEventListener("change", loadImages);
processSelect.addEventListener("change", loadImages);

/* =========================================================
   INITIAL LOAD (DEFAULT ALL / ALL)
========================================================= */
loadImages();
