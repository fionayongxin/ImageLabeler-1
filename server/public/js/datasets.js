/**
 * ======================================================
 * datasets.js  (FINAL)
 * ======================================================
 * True backend pagination.
 * Frontend never loads more than one page.
 */

/* ===================== DOM ===================== */

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

/* ===================== STATE ===================== */

const PAGE_SIZE = 24;
let currentPage = 1;
let totalImages = 0;

/* ===================== RENDER ===================== */

function renderPage(images) {
  const fragment = document.createDocumentFragment();

  images.forEach(src => {
    const img = document.createElement("img");
    img.src = src; // thumbnail
    img.width = 180;
    img.height = 180;
    img.loading = "lazy";
    img.onclick = () =>
      window.open(
        src
          .replace("/thumbs/datasets/", "/datasets/")
          .replace(/\/([^/]+)$/, "/images/$1"),
        "_blank"
      );

    fragment.appendChild(img);
  });

  gallery.innerHTML = "";
  gallery.appendChild(fragment);
  galleryWrapper.scrollTop = 0;

  updatePaginationUI();
}

function updatePaginationUI() {
  const totalPages = Math.max(
    1,
    Math.ceil(totalImages / PAGE_SIZE)
  );

  pageInfo.textContent = `of ${totalPages}`;
  pageInput.value = currentPage;
  pageInput.max = totalPages;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

/* ===================== LOAD ===================== */

async function loadImages(page = 1) {
  const station = stationSelect.value;
  const process = processSelect.value;

  statusBox.textContent = "Loading images...";
  gallery.innerHTML = "";
  currentPage = page;

  const stationsToLoad =
    station === "ALL" ? ["station_01", "station_02"] : [station];

  const processesToLoad =
    process === "ALL" ? ["final_inspection", "pre_inspection"] : [process];

  try {
    const requests = [];

    for (const st of stationsToLoad) {
      for (const pr of processesToLoad) {
        requests.push(
          fetch(
            `/api/datasets/images?station=${encodeURIComponent(st)}&process=${encodeURIComponent(pr)}&page=${page}&limit=${PAGE_SIZE}`
          ).then(r => (r.ok ? r.json() : { total: 0, images: [] }))
        );
      }
    }

    const results = await Promise.all(requests);

    const images = results.flatMap(r => r.images || []);
    totalImages = results.reduce((sum, r) => sum + (r.total || 0), 0);

    if (images.length === 0) {
      statusBox.textContent = "No images found.";
      updatePaginationUI();
      return;
    }

    statusBox.textContent = `${totalImages} images found`;
    renderPage(images);

  } catch (err) {
    console.error(err);
    statusBox.textContent = "Failed to load images.";
  }
}

/* ===================== PAGINATION ===================== */

prevBtn.onclick = () => {
  if (currentPage > 1) loadImages(currentPage - 1);
};

nextBtn.onclick = () => {
  const totalPages = Math.ceil(totalImages / PAGE_SIZE);
  if (currentPage < totalPages) loadImages(currentPage + 1);
};

goBtn.onclick = () => {
  const target = Number(pageInput.value);
  const totalPages = Math.ceil(totalImages / PAGE_SIZE);

  if (target >= 1 && target <= totalPages) {
    loadImages(target);
  }
};

/* ===================== FILTERS ===================== */

stationSelect.onchange = () => loadImages(1);
processSelect.onchange = () => loadImages(1);

/* ===================== INIT ===================== */

loadImages();