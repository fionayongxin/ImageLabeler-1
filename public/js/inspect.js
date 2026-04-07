async function updateConfig() {
  const required = [...document.querySelectorAll("input[type=checkbox]:checked")]
    .map(cb => cb.value);

  const confidence = document.getElementById("conf").value;

  await fetch("http://localhost:8000/configure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      required_classes: required,
      confidence: confidence
    })
  });
}

document.querySelectorAll("input").forEach(el => {
  el.addEventListener("change", updateConfig);
});

setInterval(async () => {
  try {
    const res = await fetch("http://localhost:8000/status");
    const data = await res.json();

    const el = document.getElementById("result");
    el.textContent = data.result;
    el.style.color = data.result === "PASS" ? "green" : "red";
  } catch (e) {
    console.error("Status fetch failed", e);
  }
}, 500);
