const cam = document.getElementById("liveCam");
const placeholder = document.getElementById("camPlaceholder");
const resultEl = document.getElementById("resultOverlay");

cam.onload = () => {
  placeholder.style.display = "none";
};

cam.onerror = () => {
  placeholder.style.display = "flex";
};

async function pollResult() {
  try {
    const res = await fetch("/api/inspect/result");
    if (!res.ok) return;

    const { status } = await res.json();

    resultEl.textContent = status;

    resultEl.classList.remove("pass","fail","unknown");

    if (status === "PASS")
      resultEl.classList.add("pass");
    else if (status === "FAIL")
      resultEl.classList.add("fail");
    else
      resultEl.classList.add("unknown");

  } catch (err) {}
}

setInterval(pollResult, 300);