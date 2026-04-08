const resultEl = document.getElementById("result");
const confEl = document.getElementById("conf");
const confValueEl = document.getElementById("confValue");
const applyBtn = document.getElementById("apply");

confValueEl.textContent = Number(confEl.value).toFixed(2);

// Update confidence label live
confEl.addEventListener("input", () => {
  confValueEl.textContent = Number(confEl.value).toFixed(2);
});

applyBtn.addEventListener("click", async () => {
  const required = [...document.querySelectorAll(".req:checked")]
    .map(cb => cb.value);

  const forbidden = [...document.querySelectorAll(".forbid:checked")]
    .map(cb => cb.value);

  const confidence = Number(confEl.value);

  await fetch("/api/inspect/criteria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      required,
      forbidden,
      confidence
    })
  });

  resultEl.textContent = "CRITERIA APPLIED";
  resultEl.style.color = "#888";

  console.log("🔧 Applied", { required, forbidden, confidence });
});

async function pollResult() {
  try {
    const res = await fetch("/api/inspect/result");
    if (!res.ok) return;

    const { status, detected } = await res.json();

    resultEl.textContent = status;

    if (status === "PASS") {
      resultEl.style.color = "#00ff88";
    } else if (status === "FAIL") {
      resultEl.style.color = "#ff4455";
    } else {
      resultEl.style.color = "#888";
    }
  } catch {}
}

// poll every 300ms
setInterval(pollResult, 300);