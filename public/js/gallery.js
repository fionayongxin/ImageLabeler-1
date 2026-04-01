const gallery = document.getElementById("gallery");

function openLabeler() {
  window.location.href = "/labeler.html";
}

fetch("/api/photos")
  .then(r => r.json())
  .then(files => {
    files.forEach(f => {
      const img = document.createElement("img");
      img.src = `/photos/${f}`;
      gallery.appendChild(img);
    });
  });