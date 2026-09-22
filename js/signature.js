// EventQ - Signature pad (hotel key pickup proof)

window.initSignaturePad = function () {
  const canvas = document.getElementById("signature-pad");
  if (!canvas) return;
  window.sigCanvas = canvas;
  window.sigCtx = canvas.getContext("2d");
  window.isSigCanvasEmpty = true;

  let isDrawing = false;
  let lastX = 0,
    lastY = 0;

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [clientX - rect.left, clientY - rect.top];
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    window.isSigCanvasEmpty = false;
    [lastX, lastY] = getCoords(e);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const [x, y] = getCoords(e);
    window.sigCtx.beginPath();
    window.sigCtx.moveTo(lastX, lastY);
    window.sigCtx.lineTo(x, y);
    window.sigCtx.strokeStyle = "#1e293b"; // slate-800
    window.sigCtx.lineWidth = 2.5;
    window.sigCtx.lineCap = "round";
    window.sigCtx.lineJoin = "round";
    window.sigCtx.stroke();
    [lastX, lastY] = [x, y];
  }

  function stopDraw(e) {
    e.preventDefault();
    isDrawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseout", stopDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw, { passive: false });
};

window.clearSignature = function () {
  if (window.sigCanvas && window.sigCtx) {
    window.sigCtx.clearRect(0, 0, window.sigCanvas.width, window.sigCanvas.height);
    window.isSigCanvasEmpty = true;
  }
};

window.cancelSignature = function () {
  if (window.tempCheckboxElement) window.tempCheckboxElement.checked = false;
  window.closeModalAnimated("modal-signature");
};

window.saveSignature = function () {
  const name = document.getElementById("sig-name").value.trim();
  if (!name) return window.showToast("Nama pengambil kunci wajib diisi!", "error");
  const requiresSignature = window.currentSigRequiresSignature !== false;
  if (requiresSignature && window.isSigCanvasEmpty)
    return window.showToast("Tanda tangan belum diisi!", "error");

  const sigData = requiresSignature ? window.sigCanvas.toDataURL("image/png") : null;
  const g = window.guests.find((x) => x.id === window.currentSigGuestId);
  if (g) {
    g.kunciDiambil = true;
    g.kunciDiambilOleh = name;
    g.kunciSignature = sigData;
    // Mark linked guests (same room + same origin) too
    const linked = window.findLinkedGuests(g);
    linked.forEach((lg) => {
      lg.kunciDiambil = true;
      lg.kunciDiambilOleh = name;
      lg.kunciSignature = sigData;
    });
    saveGuests();
    window.renderTable();
    window.showToast(
      linked.length > 0
        ? `Bukti pengambilan kunci disimpan untuk ${1 + linked.length} tamu sekamar!`
        : "Bukti pengambilan kunci disimpan!",
      "success"
    );
  }
  window.closeModalAnimated("modal-signature");
};

window.previewSignature = function (guestId) {
  const g = window.guests.find((x) => x.id === guestId);
  if (g && g.kunciDiambil && g.kunciSignature) {
    document.getElementById("preview-sig-name").innerText = g.kunciDiambilOleh || "-";
    document.getElementById("preview-sig-img").src = g.kunciSignature || "";
    window.openModalAnimated("modal-preview-signature");
  }
};
