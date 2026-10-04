// EventQ - Participant registration, tables, attendance, QR actions and Excel I/O.
// Storage is intentionally accessed through LS only; LS owns persistence/error handling.

// Versi data lokal — bertambah setiap kali ada perubahan lewat saveGuests().
// Dipakai window.refreshGuestData (baik manual maupun auto-refresh 5 detik) untuk
// membatalkan penerapan hasil fetch bila ada edit baru di tengah request berjalan.
let guestLocalVersion = 0;

function saveGuests() {
  const id = window.appState?.currentEventId;
  if (!id) return false;
  const saved = LS.setGuests(id, window.guests || []);
  // Tandai bahwa data lokal berubah; auto-refresh yang sedang menunggu respons
  // server akan membatalkan penerapannya (lihat window.refreshGuestData).
  guestLocalVersion++;
  if (saved !== false && typeof window.broadcastGuestsChanged === "function")
    window.broadcastGuestsChanged(id);
  return saved !== false;
}
window.saveGuests = saveGuests;

const guestText = (v) => String(v ?? "");
const esc = (v) =>
  guestText(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function matchKey(nama, rs) {
  return window.guestMatchKey
    ? window.guestMatchKey(nama, rs)
    : `${guestText(nama).trim().toLowerCase()}|${guestText(rs).trim().toLowerCase()}`;
}
function eventForGuests() {
  return LS.getEvents().find((e) => e.id === window.appState?.currentEventId);
}

// ===== Nomor Khusus/Unik (custom fields) <-> kolom Excel =====
// Template, export, dan import memakai kolom tambahan bernama sesuai label tiap field kustom
// event. Field ini bebas diisi (tidak ada aturan unik) - nilainya disimpan apa adanya sebagai teks.
const RESERVED_XLSX_HEADERS = new Set(
  ["no", "quest id", "nama lengkap", "asal rs", "jabatan", "no kursi", "no meja",
   "no kamar", "kunci", "status", "waktu absen"],
);
// Daftar { field, header } dengan nama kolom yang dijamin tidak bentrok dengan kolom standar
// maupun dengan field kustom lain yang labelnya sama. Dipakai bersama template, export & import
// supaya nama kolom selalu konsisten di ketiganya.
function customColumns(evt) {
  const used = new Set();
  return (Array.isArray(evt?.customNumberFields) ? evt.customNumberFields : []).map((f) => {
    let header = guestText(f.label).trim() || "Nomor Khusus";
    if (RESERVED_XLSX_HEADERS.has(header.toLowerCase())) header += " (Custom)";
    let candidate = header, n = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${header} (${n++})`;
    used.add(candidate.toLowerCase());
    return { field: f, header: candidate };
  });
}
// Excel menyimpan angka murni sebagai number; ubah ke teks tanpa notasi ilmiah (mis. 3.2E+15)
// supaya NIK/nomor registrasi yang terlanjur tersimpan sebagai angka tetap terbaca utuh.
function cellToText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 1e21) return BigInt(v).toString();
    return String(v);
  }
  return String(v).trim();
}
// Baca nilai semua kolom custom dari satu baris Excel (pencocokan nama kolom tidak peka
// huruf besar/kecil & spasi di pinggir). Kolom kosong dilewati.
function readCustomNumbers(row, evt) {
  const cols = customColumns(evt);
  if (!cols.length) return {};
  const byHeader = {};
  Object.keys(row).forEach((k) => { byHeader[String(k).trim().toLowerCase()] = row[k]; });
  const out = {};
  cols.forEach(({ field, header }) => {
    const text = cellToText(byHeader[header.toLowerCase()]);
    if (text) out[field.id] = text;
  });
  return out;
}
// Tambahkan kolom custom ke satu baris export (nilai tetap string supaya Excel menyimpannya sebagai teks).
function addCustomColumns(row, guest, evt) {
  customColumns(evt).forEach(({ field, header }) => {
    row[header] = guestText(guest.customNumbers?.[field.id]);
  });
}
function initialsOf(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const can = (key) =>
  typeof window.hasFeaturePerm !== "function" || window.hasFeaturePerm(key);
const nowTime = () =>
  new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function customValues(containerId) {
  if (typeof window.collectCustomNumberValues === "function")
    return window.collectCustomNumberValues(containerId);
  const out = {};
  document
    .getElementById(containerId)
    ?.querySelectorAll("[data-custom-field-id]")
    .forEach((el) => {
      if (el.value.trim()) out[el.dataset.customFieldId] = el.value.trim();
    });
  return out;
}
function customDuplicate(evt, values, exclude) {
  if (typeof window.findDuplicateCustomNumberField === "function")
    return window.findDuplicateCustomNumberField(evt, values, exclude);
  for (const f of evt?.customNumberFields || []) {
    const value = guestText(values[f.id]).trim();
    if (!value) continue;
    const g = window.guests.find(
      (x) =>
        x.id !== exclude && guestText(x.customNumbers?.[f.id]).trim() === value,
    );
    if (g) return { label: f.label, value, guestName: g.nama };
  }
  return null;
}
function confirmAction(title, text, yes) {
  if (typeof window.openConfirmCustom === "function")
    window.openConfirmCustom(title, text, yes);
  else yes();
}

window.handleGenerateSubmit = function (e) {
  e.preventDefault();
  const name = document.getElementById("input-nama")?.value.trim() || "";
  const proceed = () => {
    const evt = eventForGuests();
    const values = customValues("container-custom-number-fields");
    const dup = customDuplicate(evt, values, null);
    if (dup)
      return confirmAction(
        "Nomor Sudah Terpakai",
        `Nomor ${dup.label || "khusus"} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap lanjutkan?`,
        window.processGenerateGuest,
      );
    window.processGenerateGuest();
  };
  if (
    name &&
    window.guests.some(
      (g) => guestText(g.nama).trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return confirmAction(
      window.t?.("modal_dup_name_title") || "Nama Sudah Terdaftar",
      `Nama "${name}" sudah terdaftar. Tetap lanjutkan?`,
      proceed,
    );
  }
  proceed();
};

window.processGenerateGuest = function () {
  const btn = document.getElementById("btn-submit-generate");
  const original = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memproses...`;
  }
  setTimeout(() => {
    const evt = eventForGuests();
    if (!evt) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
      return;
    }
    const guest = {
      id: window.generateGuestId(evt.type),
      nama: document.getElementById("input-nama")?.value.trim() || "",
      rs: document.getElementById("input-rs")?.value.trim() || "",
      jabatan: document.getElementById("input-jabatan")?.value.trim() || "",
      kursi:
        evt.needsSeat !== false
          ? document.getElementById("input-kursi")?.value.trim() || "-"
          : "-",
      kamar: evt.needsHotel
        ? document.getElementById("input-kamar")?.value.trim() || "-"
        : "-",
      customNumbers: customValues("container-custom-number-fields"),
      kunciDiambil: false,
      pickupScanned: false,
      pickupScanTime: null,
      scanned: false,
      scanTime: null,
      created: Date.now(),
    };
    window.guests.push(guest);
    if (saveGuests()) {
      document.getElementById("form-generate")?.reset();
      if (typeof window.renderCustomNumberFieldsForm === "function")
        window.renderCustomNumberFieldsForm(
          evt,
          "container-custom-number-fields",
          "custom-gen",
          {},
          null,
        );
      window.renderGenerateSideStats?.();
      window.showToast?.("Peserta berhasil ditambahkan!", "success");
      window.showQRCode?.(
        guest.id,
        guest.nama,
        guest.rs,
        guest.jabatan,
        guest.kursi,
      );
    } else window.guests.pop();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }, 300);
};

window.renderGenerateSideStats = function () {
  const el = document.getElementById("generate-side-total");
  if (el) el.innerText = window.guests.length;
};

window.renderScanStats = function () {
  const total = window.guests.length;
  const hadir = window.guests.filter((g) => g.scanned).length;
  const elTotal = document.getElementById("scan-stat-total");
  if (elTotal) elTotal.innerText = total;
  const elHadir = document.getElementById("scan-stat-hadir");
  if (elHadir) elHadir.innerText = hadir;
  const elBelum = document.getElementById("scan-stat-belum");
  if (elBelum) elBelum.innerText = total - hadir;
};

window.renderDashboard = function () {
  const guests = window.guests || [],
    present = guests.filter((g) => g.scanned).length,
    total = guests.length;
  document
    .getElementById("dash-total")
    ?.replaceChildren(document.createTextNode(total));
  document
    .getElementById("dash-hadir")
    ?.replaceChildren(document.createTextNode(present));
  document
    .getElementById("dash-persen")
    ?.replaceChildren(
      document.createTextNode(
        `${total ? Math.round((present / total) * 100) : 0}%`,
      ),
    );
  const feedNew = document.getElementById("feed-new-guests"),
    feedAtt = document.getElementById("feed-attendances");
  const emptyFeed = (icon, text) =>
    `<div class="flex flex-col items-center justify-center text-center py-8 text-slate-400 dark:text-slate-500"><i class="fa-solid ${icon} text-2xl mb-2 opacity-60"></i><span class="text-xs font-medium">${text}</span></div>`;
  const recentNew = guests.slice().reverse().slice(0, 5);
  if (feedNew)
    feedNew.innerHTML = recentNew.length
      ? recentNew
          .map(
            (g) =>
              `<div class="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40"><div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center shrink-0">${initialsOf(g.nama)}</div><div class="flex flex-col min-w-0 flex-1"><span class="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">${esc(g.nama)}</span><span class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(g.rs)}</span></div><span class="text-[11px] shrink-0 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full font-semibold">Baru</span></div>`,
          )
          .join("")
      : emptyFeed(
          "fa-user-plus",
          window.currentLang === "id"
            ? "Belum ada pendaftar"
            : "No registrants yet",
        );
  const recentAtt = guests
    .filter((g) => g.scanned)
    .sort((a, b) => guestText(a.scanTime).localeCompare(guestText(b.scanTime)))
    .slice(-5)
    .reverse();
  if (feedAtt)
    feedAtt.innerHTML = recentAtt.length
      ? recentAtt
          .map(
            (g) =>
              `<div class="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors hover:border-emerald-200 dark:hover:border-emerald-500/40"><div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">${initialsOf(g.nama)}</div><div class="flex flex-col min-w-0 flex-1"><span class="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">${esc(g.nama)}</span><span class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(g.rs)}</span></div><span class="text-[11px] shrink-0 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold whitespace-nowrap"><i class="fa-solid fa-clock mr-1"></i>${esc(g.scanTime)}</span></div>`,
          )
          .join("")
      : emptyFeed(
          "fa-user-check",
          window.currentLang === "id"
            ? "Belum ada kehadiran"
            : "No attendance yet",
        );
  if (typeof chartRS !== "undefined" && chartRS) chartRS.destroy();
  if (typeof chartStatus !== "undefined" && chartStatus) chartStatus.destroy();
  const rsCanvas = document.getElementById("chart-rs"),
    statusCanvas = document.getElementById("chart-status");
  if (!rsCanvas || !statusCanvas || typeof Chart === "undefined") return;
  const counts = {};
  guests.forEach((g) => (counts[g.rs] = (counts[g.rs] || 0) + 1));
  let values = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (document.getElementById("rs-chart-mode")?.value === "top5")
    values = values.slice(0, 5);
  const isDarkMode = document.documentElement.classList.contains("dark");
  const axisTextColor = isDarkMode ? "#cbd5e1" : "#334155",
    gridColor = isDarkMode ? "rgba(148, 163, 184, 0.15)" : "#e2e8f0",
    legendTextColor = isDarkMode ? "#e2e8f0" : "#334155";
  const chartPlugins =
    typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [];
  chartRS = new Chart(rsCanvas.getContext("2d"), {
    type: "bar",
    plugins: chartPlugins,
    data: {
      labels: values.map((x) => x[0]),
      datasets: [
        {
          label: window.t("dash_reg"),
          data: values.map((x) => x[1]),
          backgroundColor: "#6366f1",
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold", size: 14 },
          formatter: Math.round,
          anchor: "end",
          align: "start",
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: axisTextColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: axisTextColor, autoSkip: false },
          grid: { display: false },
        },
      },
    },
  });
  chartStatus = new Chart(statusCanvas.getContext("2d"), {
    type: "doughnut",
    plugins: chartPlugins,
    data: {
      labels: [window.t("dash_att"), "Belum"],
      datasets: [
        {
          data: [present, total - present],
          backgroundColor: ["#10b981", isDarkMode ? "#475569" : "#cbd5e1"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { position: "bottom", labels: { color: legendTextColor } },
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold", size: 16 },
          formatter: (value) => (value > 0 ? value : ""),
        },
      },
    },
  });
};

const SORTS = {
  nama_asc: ["nama", 1],
  nama_desc: ["nama", -1],
  rs_asc: ["rs", 1],
  rs_desc: ["rs", -1],
  jabatan_asc: ["jabatan", 1],
  jabatan_desc: ["jabatan", -1],
};
function sortGuests(list, key) {
  const s = SORTS[key];
  return s
    ? list.slice().sort(
        (a, b) =>
          s[1] *
          guestText(a[s[0]]).localeCompare(guestText(b[s[0]]), "id", {
            sensitivity: "base",
            numeric: true,
          }),
      )
    : list;
}
function filteredGuests() {
  const q = (document.getElementById("search-list")?.value || "").toLowerCase(),
    status = document.getElementById("filter-status")?.value || "all";
  return window.guests.filter(
    (g) =>
      [g.nama, g.id, g.rs].some((v) =>
        guestText(v).toLowerCase().includes(q),
      ) &&
      (status === "all" || (status === "hadir" ? g.scanned : !g.scanned)),
  );
}
function selectedUI() {
  const set = window.selectedGuestIds || (window.selectedGuestIds = new Set());
  const indicator = document.getElementById("selected-guests-indicator");
  if (indicator) indicator.style.display = set.size ? "inline-flex" : "none";
  const count = document.getElementById("selected-guests-count-text");
  if (count) count.innerText = `${set.size} peserta dipilih`;
  const badge = document.getElementById("badge-print-selected-count");
  if (badge) {
    badge.innerText = set.size;
    badge.style.display = set.size ? "inline-flex" : "none";
  }
  const all = document.getElementById("checkbox-select-all-guests"),
    list = filteredGuests(),
    n = list.filter((g) => set.has(g.id)).length;
  if (all) {
    all.checked = !!list.length && n === list.length;
    all.indeterminate = n > 0 && n < list.length;
  }
}
window.toggleGuestSelection = function (id, checked) {
  (window.selectedGuestIds || (window.selectedGuestIds = new Set()))[
    checked ? "add" : "delete"
  ](id);
  selectedUI();
};
window.toggleSelectAllGuests = function (checked) {
  const set = window.selectedGuestIds || (window.selectedGuestIds = new Set());
  filteredGuests().forEach((g) => (checked ? set.add(g.id) : set.delete(g.id)));
  window.renderTable();
};
window.clearGuestSelection = function () {
  window.selectedGuestIds?.clear();
  window.renderTable();
};
window.updateGuestSelectionUI = selectedUI;

function actionMenu(guest) {
  const hasAnyRowAction =
    (!guest.scanned && window.hasFeaturePerm?.("actionManual")) ||
    window.hasFeaturePerm?.("actionPreviewQR") ||
    window.hasFeaturePerm?.("actionPrintQR") ||
    window.hasFeaturePerm?.("actionEdit") ||
    window.hasFeaturePerm?.("actionDelete");
  if (!hasAnyRowAction) return "";
  return `<div class="relative inline-flex"><button type="button" onclick="window.toggleGuestActionMenu?.('${esc(guest.id)}',this)" class="w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 mx-0.5 transition-colors" title="Aksi"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>`;
}
function createGuestRow(guest, index) {
  const evt = eventForGuests(),
    hidden = evt?.hiddenColumns || [],
    tr = document.createElement("tr");
  tr.className =
    "hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors";

  const rsCell = hidden.includes("rs")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.rs)}</td>`;
  const jabatanCell = hidden.includes("jabatan")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.jabatan)}</td>`;

  let seatCell = "";
  if (evt?.needsSeat !== false && !hidden.includes("kursi")) {
    seatCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.kursi)}</td>`;
  }

  let hotelCells = "";
  if (evt?.needsHotel) {
    const hasRoom = guest.kamar && guest.kamar !== "-";
    const checkedAttr = guest.kunciDiambil ? "checked" : "";
    const disabledAttr = !hasRoom ? "disabled" : "";
    const opacityClass = !hasRoom
      ? "opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-600"
      : "cursor-pointer focus:ring-indigo-500";
    const previewBtn =
      guest.kunciDiambil && guest.kunciSignature
        ? `<button onclick="window.previewSignature('${esc(guest.id)}')" class="ml-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors" title="Lihat Bukti Tanda Tangan"><i class="fa-solid fa-file-signature text-base"></i></button>`
        : "";

    const kamarCell = hidden.includes("kamar")
      ? ""
      : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.kamar || "-")}</td>`;
    const kunciCell = hidden.includes("kunci")
      ? ""
      : `<td class="px-5 py-3.5 text-center">
      <div class="flex items-center justify-center">
        <input type="checkbox" onchange="window.toggleKey('${esc(guest.id)}', this.checked, this)" ${checkedAttr} ${disabledAttr} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 shadow-sm ${opacityClass}" title="${!hasRoom ? "Isi nomor kamar terlebih dahulu" : ""}">
        ${previewBtn}
      </div>
    </td>`;
    hotelCells = kamarCell + kunciCell;
  }

  const statusBadge = guest.scanned
    ? '<span class="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-md font-semibold"><i class="fa-solid fa-circle-check text-[11px]"></i>Hadir</span>'
    : '<span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold"><i class="fa-regular fa-circle text-[11px]"></i>Belum</span>';

  const downloadQRBtn = can("actionDownloadQR")
    ? `<button onclick="window.downloadSingleQR('${esc(guest.id)}','${esc(guest.rs)}','${esc(guest.nama)}')" class="w-8 h-8 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 mx-0.5 transition-colors" title="Download QR"><i class="fa-solid fa-download"></i></button>`
    : "";

  const selectCell = `<td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleGuestSelection('${esc(guest.id)}',this.checked)" ${window.selectedGuestIds?.has(guest.id) ? "checked" : ""} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"></td>`;

  tr.innerHTML = `${selectCell}
    <td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${index + 1}</td>
    <td class="px-5 py-3.5 text-sm"><span class="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md text-xs">${esc(guest.id)}</span></td>
    <td class="px-5 py-3.5 text-sm">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">${initialsOf(guest.nama)}</span>
        <span class="font-medium text-slate-700 dark:text-slate-200">${esc(guest.nama)}</span>
      </div>
    </td>
    ${rsCell}${jabatanCell}${seatCell}${hotelCells}
    <td class="px-5 py-3.5">${statusBadge}</td>
    <td class="px-5 py-3.5 text-center whitespace-nowrap"><div class="flex items-center justify-center">${downloadQRBtn}${actionMenu(guest)}</div></td>`;
  return tr;
}
function createAttendedRow(guest, index) {
  const evt = eventForGuests(),
    hidden = evt?.hiddenColumns || [],
    tr = document.createElement("tr");
  tr.className =
    "hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors";

  const rsCell = hidden.includes("rs")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.rs)}</td>`;
  const jabatanCell = hidden.includes("jabatan")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.jabatan)}</td>`;

  let seatCell = "";
  if (evt?.needsSeat !== false && !hidden.includes("kursi")) {
    seatCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.kursi)}</td>`;
  }

  let hotelCell = "";
  if (evt?.needsHotel && !hidden.includes("kamar")) {
    hotelCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${esc(guest.kamar || "-")}</td>`;
  }

  tr.innerHTML = `<td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${index + 1}</td>
    <td class="px-5 py-3.5 text-sm"><span class="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md text-xs">${esc(guest.id)}</span></td>
    <td class="px-5 py-3.5 text-sm">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">${initialsOf(guest.nama)}</span>
        <span class="font-medium text-slate-700 dark:text-slate-200">${esc(guest.nama)}</span>
      </div>
    </td>
    ${rsCell}${jabatanCell}${seatCell}${hotelCell}
    <td class="px-5 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-300"><i class="fa-regular fa-clock mr-1 text-emerald-500 dark:text-emerald-400"></i>${esc(guest.scanTime)}</td>
    <td class="px-5 py-3.5 text-center"><button onclick="window.removeAttendance('${esc(guest.id)}')" class="text-xs bg-red-50 dark:bg-red-500/10 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white border border-red-200 dark:border-red-500/30 py-1.5 px-3 rounded-lg shadow-sm flex items-center mx-auto transition-colors"><i class="fa-solid fa-xmark mr-1.5"></i> Batal</button></td>`;
  return tr;
}
window.renderTable = function () {
  const tbody = document.getElementById("table-body"),
    attendedBody = document.getElementById("table-body-attended");
  if (!tbody || !attendedBody) return;
  const search = (
    document.getElementById("search-attended")?.value || ""
  ).toLowerCase();
  const list = sortGuests(
    filteredGuests(),
    document.getElementById("sort-list")?.value || "default",
  );
  const attended = sortGuests(
    window.guests.filter(
      (g) =>
        g.scanned &&
        [g.nama, g.id, g.rs].some((v) =>
          guestText(v).toLowerCase().includes(search),
        ),
    ),
    document.getElementById("sort-attended")?.value || "default",
  );
  const pageSize = 10;
  window.currentPageGuests = Math.max(
    1,
    Math.min(
      window.currentPageGuests || 1,
      Math.max(1, Math.ceil(list.length / pageSize)),
    ),
  );
  window.currentPageAttended = Math.max(
    1,
    Math.min(
      window.currentPageAttended || 1,
      Math.max(1, Math.ceil(attended.length / pageSize)),
    ),
  );
  const totalGuests = window.guests.length,
    totalAttended = window.guests.filter((g) => g.scanned).length,
    totalPending = totalGuests - totalAttended;
  document.getElementById("total-guests") &&
    (document.getElementById("total-guests").innerText =
      `Total: ${list.length}`);
  document.getElementById("total-attended") &&
    (document.getElementById("total-attended").innerText =
      `Hadir: ${attended.length}`);
  document.getElementById("stat-total-guests") &&
    (document.getElementById("stat-total-guests").innerText = totalGuests);
  document.getElementById("stat-hadir-guests") &&
    (document.getElementById("stat-hadir-guests").innerText = totalAttended);
  document.getElementById("stat-belum-guests") &&
    (document.getElementById("stat-belum-guests").innerText = totalPending);
  const progress = totalGuests
    ? Math.round((totalAttended / totalGuests) * 100)
    : 0;
  const progressBar = document.getElementById("attended-progress-bar");
  if (progressBar) progressBar.style.width = `${progress}%`;
  const progressText = document.getElementById("attended-progress-text");
  if (progressText)
    progressText.innerText = `${totalAttended} dari ${totalGuests} peserta (${progress}%)`;
  tbody.replaceChildren(
    ...list
      .slice(
        (window.currentPageGuests - 1) * pageSize,
        window.currentPageGuests * pageSize,
      )
      .map((g, i) =>
        createGuestRow(g, (window.currentPageGuests - 1) * pageSize + i),
      ),
  );
  attendedBody.replaceChildren(
    ...attended
      .slice(
        (window.currentPageAttended - 1) * pageSize,
        window.currentPageAttended * pageSize,
      )
      .map((g, i) =>
        createAttendedRow(g, (window.currentPageAttended - 1) * pageSize + i),
      ),
  );
  document
    .getElementById("empty-state")
    ?.classList.toggle("hidden", !!list.length);
  document
    .getElementById("empty-state-attended")
    ?.classList.toggle("hidden", !!attended.length);
  window.renderPagination?.(
    list.length,
    pageSize,
    window.currentPageGuests,
    "pagination-list",
    "changePageGuests",
  );
  window.renderPagination?.(
    attended.length,
    pageSize,
    window.currentPageAttended,
    "pagination-attended",
    "changePageAttended",
  );
  selectedUI();
};

// Refresh data peserta dari server tanpa reload halaman (menjaga event/tab aktif).
// Dipanggil manual lewat tombol (btn dipassing + toast), dan otomatis tiap 5 detik
// oleh interval di startGuestAutoRefresh (lihat blok Auto-refresh di bawah).
window.refreshGuestData = async function (btn, opts = {}) {
  const silent = opts.silent === true;
  const eventId = window.appState?.currentEventId;
  if (!eventId) return false;
  if (guestAutoRefreshBusy) return false; // jangan tumpuk request
  guestAutoRefreshBusy = true;
  const key = `qis_guests_${eventId}`;
  const icon = btn?.querySelector("i");
  const originalClass = icon?.className;
  const badgeIcons = document.querySelectorAll(".auto-refresh-icon");
  const guestLocalVersionAtStart = guestLocalVersion;
  if (icon) {
    icon.classList.remove("fa-rotate");
    icon.classList.add("fa-spin", "fa-spinner");
    btn.disabled = true;
  }
  badgeIcons.forEach((i) => i.classList.add("fa-spin"));
  try {
    const res = await fetch(`${window.API_BASE}/state/${encodeURIComponent(key)}`);
    // 404 = event ini belum pernah tersimpan di server (mis. event lama yang masih
    // lokal). Jangan dianggap error, dan jangan menimpa data lokal yang masih ada.
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = typeof data.value === "string" ? data.value : JSON.stringify(data.value ?? []);
    // Jangan pernah timpa data lokal bila: (1) ada perubahan lokal saat request
    // berjalan (edit/import/absen yang baru saja disimpan), (2) key punya write
    // pending/in-flight, atau (3) write sedang gagal tersimpan (biarkan Cache
    // yang menangani). Tanpa pengecekan ini, auto-refresh tiap 5 detik bisa saja
    // menimpa edit yang baru diketik pengguna.
    if (guestLocalVersion !== guestLocalVersionAtStart) return false;
    const prev = Cache.get(key); // diambil SEBELUM applyRemote menimpa store
    if (Cache._failed.has(key) || !Cache.applyRemote(key, raw)) return false;
    if (prev === raw) return true; // tidak ada perubahan: tidak perlu render ulang
    window.guests = JSON.parse(raw || "[]");
    window.renderTable();
    window.renderScanStats?.();
    if (!silent) window.showToast("Data peserta dimuat ulang dari server.", "success");
    return true;
  } catch (err) {
    console.error("refreshGuestData failed:", err);
    // Mode silent (auto-refresh) tidak boleh memunculkan toast: jaringan yang
    // lagi buruk akan membuat toast error beruntun tiap 5 detik.
    if (!silent) window.showToast("Gagal memuat ulang data dari server!", "error");
    return false;
  } finally {
    guestAutoRefreshBusy = false;
    if (icon && originalClass) {
      icon.classList.remove("fa-spin", "fa-spinner");
      icon.className = originalClass;
    }
    if (btn) btn.disabled = false;
    // Berhenti memutar ikon badge; kalau di tengah request pengguna pindah tab
    // (timer sudah dihentikan oleh stopGuestAutoRefresh), baris ini juga aman
    // karena hanya menghapus kelas yang memang sudah dipasang di awal.
    badgeIcons.forEach((i) => i.classList.remove("fa-spin"));
  }
};

// ===== Auto-refresh data peserta (tiap 5 detik) =====
// Menggantikan tombol Refresh manual: data ditarik ulang dari server selama
// pengguna berada di tab Data Peserta (list) atau Daftar Hadir (attended).
// Timer dihentikan begitu pindah tab/keluar event/masuk Mode Kiosk, agar tidak
// membuang request di halaman yang memang tidak menampilkan data peserta.
const GUEST_AUTO_REFRESH_MS = 5000;
const GUEST_AUTO_REFRESH_TABS = ["list", "attended"];
let guestAutoRefreshTimer = null;
let guestAutoRefreshBusy = false;

// Kondisi halaman (start/stop timer) — hanya dipanggil lewat jalur navigasi
// yang memanggil window.guestAutoRefreshSync, jadi aman untuk menentukan
// start/stop lifecycle.
function guestAutoRefreshAllowed() {
  if (!window.appState?.currentEventId) return false;
  const appView = document.getElementById("view-app");
  if (!appView || appView.classList.contains("view-hidden")) return false;
  // Kiosk menutupi seluruh tampilan event, jadi bukan halaman data peserta.
  const kioskView = document.getElementById("kiosk-mode-view");
  if (kioskView && !kioskView.classList.contains("hidden")) return false;
  return GUEST_AUTO_REFRESH_TABS.some((tab) =>
    document.getElementById(`tab-content-${tab}`)?.classList.contains("active"),
  );
}

// Kondisi sementara (lewati satu tick saja, timer tetap jalan) — modal/progres/
// import sedang terbuka berarti pengguna sedang bekerja di atas data; refresh
// di tengah itu bisa menutup hasil kerjanya.
function guestAutoRefreshShouldSkip() {
  if (guestAutoRefreshBusy) return true; // request sebelumnya belum selesai
  if (document.hidden) return true; // tab di background: browser throttling, skip saja
  const blocking = ["modal-backdrop", "modal-backdrop-nested", "modal-progress", "modal-import-mode"];
  return blocking.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

function stopGuestAutoRefresh() {
  if (!guestAutoRefreshTimer) return;
  clearInterval(guestAutoRefreshTimer);
  guestAutoRefreshTimer = null;
  document
    .querySelectorAll(".auto-refresh-icon")
    .forEach((i) => i.classList.remove("fa-spin"));
}

function startGuestAutoRefresh() {
  if (guestAutoRefreshTimer) return;
  guestAutoRefreshTimer = setInterval(() => {
    // Jaring pengaman bila ada jalur navigasi yang tidak memanggil sync:
    // timer menghentikan dirinya sendiri pada tick berikutnya.
    if (!guestAutoRefreshAllowed()) return stopGuestAutoRefresh();
    if (guestAutoRefreshShouldSkip()) return;
    window.refreshGuestData(null, { silent: true });
  }, GUEST_AUTO_REFRESH_MS);
}

// Pusat kendali start/stop — dipanggil dari window.switchTab dan
// window.switchMainViewAnimated (js/ui.js) serta enter/exit Mode Kiosk (js/kiosk.js).
window.guestAutoRefreshSync = function () {
  if (guestAutoRefreshAllowed()) startGuestAutoRefresh();
  else stopGuestAutoRefresh();
};
window.stopGuestAutoRefresh = stopGuestAutoRefresh;

window.toggleGuestActionMenu = function (id, button) {
  const existing = document.getElementById("guest-action-menu");
  const wasOpenForThis = existing && existing.dataset.guestId === id;
  window.closeGuestActionMenu();
  if (wasOpenForThis) return;

  const g = window.guests.find((x) => x.id === id);
  if (!g) return;
  const items = [];
  if (!g.scanned && can("actionManual"))
    items.push({
      icon: "fa-check",
      label: "Absen Manual",
      color: "text-emerald-600 dark:text-emerald-400",
      onClick: `window.markAttendanceManual('${esc(g.id)}')`,
    });
  if (can("actionPreviewQR"))
    items.push({
      icon: "fa-qrcode",
      label: "Preview QR",
      color: "text-indigo-600 dark:text-indigo-400",
      onClick: `window.showQRCode('${esc(g.id)}','${esc(g.nama)}','${esc(g.rs)}','${esc(g.jabatan)}','${esc(g.kursi)}')`,
    });
  if (can("actionPrintQR"))
    items.push({
      icon: "fa-print",
      label: "Cetak QR",
      color: "text-slate-600 dark:text-slate-300",
      onClick: `window.printSingleQR?.('${esc(g.id)}')`,
    });
  if (can("actionEdit"))
    items.push({
      icon: "fa-pen",
      label: "Edit",
      color: "text-amber-500 dark:text-amber-400",
      onClick: `window.openEditModal('${esc(g.id)}')`,
    });
  if (can("actionDelete"))
    items.push({
      icon: "fa-trash",
      label: "Hapus",
      color: "text-red-500 dark:text-red-400",
      onClick: `window.openConfirmModal('guest','${esc(g.id)}')`,
    });
  if (!items.length) return;

  const menu = document.createElement("div");
  menu.id = "guest-action-menu";
  menu.dataset.guestId = id;
  menu.className =
    "fixed z-[90] w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5";
  menu.style.animation = "fadeSlideUp 0.15s ease forwards";
  menu.innerHTML = items
    .map(
      (it) =>
        `<button type="button" onclick="${it.onClick}; window.closeGuestActionMenu();" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium ${it.color} hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"><i class="fa-solid ${it.icon} w-4 text-center"></i>${it.label}</button>`,
    )
    .join("");
  document.body.appendChild(menu);

  const r = button.getBoundingClientRect();
  const menuWidth = 176;
  let left = r.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8)
    left = window.innerWidth - menuWidth - 8;
  let top = r.bottom + 6;
  const menuHeightEstimate = items.length * 38 + 12;
  if (top + menuHeightEstimate > window.innerHeight - 8)
    top = r.top - menuHeightEstimate - 6;
  menu.style.left = left + "px";
  menu.style.top = top + "px";

  setTimeout(() => {
    window._closeGuestActionMenuHandler = function (ev) {
      if (!menu.contains(ev.target)) window.closeGuestActionMenu();
    };
    document.addEventListener(
      "click",
      window._closeGuestActionMenuHandler,
      true,
    );
    window.addEventListener("scroll", window.closeGuestActionMenu, {
      once: true,
      capture: true,
    });
  }, 0);
};
window.markAttendanceManual = function (id) {
  const g = window.guests.find((x) => x.id === id);
  if (!g || g.scanned || !can("actionManual")) return;
  confirmAction(
    "Absen Peserta Ini?",
    `Kehadiran untuk ${g.nama} akan dicatat sekarang.`,
    () => {
      g.scanned = true;
      g.scanTime = nowTime();
      if (saveGuests()) {
        window.renderTable();
        window.renderScanStats?.();
        window.showToast?.(
          `Selamat datang, ${g.nama}! Kehadiran Anda tercatat.`,
          `success`,
        );
      }
    },
  );
};
window.markAllAttendance = function () {
  if (!can("markAllAttendance")) return;
  const a = window.guests.filter((g) => !g.scanned);
  if (!a.length) return;
  confirmAction(
    "Absen Semua Peserta?",
    `${a.length} peserta akan ditandai hadir.`,
    () => {
      const t = nowTime();
      a.forEach((g) => {
        g.scanned = true;
        g.scanTime = t;
      });
      saveGuests();
      window.renderTable();
    },
  );
};
window.cancelAllAttendance = function () {
  if (!can("cancelAllAttendance")) return;
  const a = window.guests.filter((g) => g.scanned);
  if (!a.length) return;
  confirmAction(
    "Batalkan Absen Semua?",
    `${a.length} status hadir akan dibatalkan.`,
    () => {
      a.forEach((g) => {
        g.scanned = false;
        g.scanTime = null;
      });
      saveGuests();
      window.renderTable();
    },
  );
};
window.removeAttendance = function (id) {
  const g = window.guests.find((x) => x.id === id);
  if (!g) return;
  confirmAction(
    "Batalkan Status Kehadiran?",
    `Status hadir untuk ${g.nama} akan dibatalkan.`,
    () => {
      g.scanned = false;
      g.scanTime = null;
      saveGuests();
      window.renderTable();
      window.showToast?.("Status absen dibatalkan", "warning");
    },
  );
};

window.openEditModal = function (id) {
  const g = window.guests.find((x) => x.id === id),
    evt = eventForGuests();
  if (!g) return;
  document.getElementById("edit-guest-id").value = id;
  document.getElementById("edit-nama").value = g.nama;
  document.getElementById("edit-rs").value = g.rs;
  document.getElementById("edit-jabatan").value = g.jabatan;
  document.getElementById("edit-kursi").value = g.kursi === "-" ? "" : g.kursi;
  document.getElementById("edit-kamar").value =
    g.kamar === "-" ? "" : g.kamar || "";
  window.renderCustomNumberFieldsForm?.(
    evt,
    "container-edit-custom-number-fields",
    "custom-edit",
    g.customNumbers || {},
    id,
  );
  window.openModalAnimated?.("modal-edit");
};
window.handleEditSubmit = function (e) {
  e.preventDefault();
  const id = document.getElementById("edit-guest-id").value,
    g = window.guests.find((x) => x.id === id),
    evt = eventForGuests();
  if (!g || !evt) return;
  const values = customValues("container-edit-custom-number-fields"),
    dup = customDuplicate(evt, values, id);
  const apply = () => {
    g.nama = document.getElementById("edit-nama").value.trim();
    g.rs = document.getElementById("edit-rs").value.trim();
    g.jabatan = document.getElementById("edit-jabatan").value.trim();
    g.kursi =
      evt.needsSeat !== false
        ? document.getElementById("edit-kursi").value || "-"
        : "-";
    g.kamar = evt.needsHotel
      ? document.getElementById("edit-kamar").value || "-"
      : "-";
    g.customNumbers = values;
    saveGuests();
    window.closeModalAnimated?.("modal-edit");
    window.renderTable();
    window.showToast?.("Data diperbarui!", "success");
  };
  if (dup)
    confirmAction(
      "Nomor Sudah Terpakai",
      `Nomor ${dup.label} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap simpan?`,
      apply,
    );
  else apply();
};

window.findLinkedGuests = function (guest) {
  const room = guestText(guest.kamar).trim(),
    rs = guestText(guest.rs).trim().toLowerCase();
  return room && room !== "-" && rs
    ? window.guests.filter(
        (x) =>
          x.id !== guest.id &&
          guestText(x.kamar).trim() === room &&
          guestText(x.rs).trim().toLowerCase() === rs,
      )
    : [];
};
window.toggleKey = function (id, checked, el) {
  const g = window.guests.find((x) => x.id === id),
    evt = eventForGuests();
  if (!g) return;
  if (checked) {
    window.currentSigGuestId = id;
    window.tempCheckboxElement = el;
    window.currentSigRequiresSignature = evt?.needsKeySignature !== false;
    document.getElementById("sig-name") &&
      (document.getElementById("sig-name").value = "");
    window.openModalAnimated?.("modal-signature");
  } else {
    if (el) el.checked = true;
    confirmAction(
      "Batalkan Bukti Pengambilan Kunci?",
      `Bukti pengambilan kunci ${g.nama} akan dibatalkan.`,
      () => {
        const linked = window.findLinkedGuests(g);
        [g, ...linked].forEach((x) => {
          x.kunciDiambil = false;
          x.kunciDiambilOleh = null;
          x.kunciSignature = null;
        });
        saveGuests();
        window.renderTable();
      },
    );
  }
};

window.createQRCanvas = window.createQRCanvas || undefined;
window.showQRCode =
  window.showQRCode ||
  function (id, nama, rs, jabatan, kursi) {
    const c = document.getElementById("qrcode-container");
    if (!c || typeof QRCode === "undefined") return;
    c.innerHTML = "";
    new QRCode(c, {
      text: id,
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.M,
    });
    document
      .getElementById("modal-qr-name")
      ?.replaceChildren(document.createTextNode(nama));
    document
      .getElementById("modal-qr-rs")
      ?.replaceChildren(document.createTextNode(rs || "-"));
    document
      .getElementById("modal-qr-jabatan")
      ?.replaceChildren(document.createTextNode(jabatan || "-"));
    document
      .getElementById("modal-qr-kursi")
      ?.replaceChildren(
        document.createTextNode(
          kursi && kursi !== "-" ? kursi : "Tidak Terdaftar",
        ),
      );
    window.openModalAnimated?.("modal-qr");
  };
window.downloadSingleQR = async function (id, rs, nama) {
  if (typeof window.createQRCanvas !== "function")
    return window.showToast?.("Fitur QR belum siap", "error");
  const url = await window.createQRCanvas(id),
    a = document.createElement("a");
  a.href = url;
  a.download = `[${rs}] ${nama}.png`;
  a.click();
};
window.bulkDownloadQR = async function () {
  if (!window.guests.length)
    return window.showToast?.("Tidak ada data peserta!", "error");
  if (typeof window.createQRCanvas !== "function") return;
  window.showToast?.("Mempersiapkan Bulk Download...", "info");
  const zip = new JSZip(),
    folder = zip.folder("QRCodes_EventQ");
  for (const g of window.guests) {
    const u = await window.createQRCanvas(g.id);
    folder.file(`[${g.rs}] ${g.nama}.png`, u.split(",")[1], { base64: true });
  }
  saveAs(await zip.generateAsync({ type: "blob" }), "QRCodes_EventQ.zip");
  window.showToast?.("Download Selesai!", "success");
};

window.exportExcel = function (type) {
  if (!window.guests.length)
    return window.showToast?.("Tidak ada data!", "error");
  const evt = eventForGuests(),
    source =
      type === "all" ? window.guests : window.guests.filter((g) => g.scanned),
    seat = evt?.seatLabelType === "meja" ? "No Meja" : "No Kursi";
  const rows = source.map((g, i) => {
    const r = {
      No: i + 1,
      "Quest ID": g.id,
      "Nama Lengkap": g.nama,
      "Asal RS": g.rs,
      Jabatan: g.jabatan,
    };
    if (evt?.needsSeat !== false) r[seat] = g.kursi;
    if (evt?.needsHotel) r["No Kamar"] = g.kamar || "-";
    addCustomColumns(r, g, evt);
    if (type === "all") r.Status = g.scanned ? "Hadir" : "Belum";
    r["Waktu Absen"] = g.scanTime || "-";
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(rows),
    wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(
    wb,
    type === "all" ? "List_Seluruh_Peserta.xlsx" : "Daftar_Hadir.xlsx",
  );
};
window.downloadTemplate = function () {
  const e = eventForGuests(),
    r = {
      "Nama Lengkap": "Dr. Andini",
      "Asal RS": "RS Bunda",
      Jabatan: "Spesialis Anak",
    };
  if (!e || e.needsSeat !== false)
    r[e?.seatLabelType === "meja" ? "No Meja" : "No Kursi"] = "VVIP-1";
  if (e?.needsHotel) r["No Kamar"] = "201";
  const customCols = customColumns(e);
  customCols.forEach(({ header }, i) => { r[header] = `${3201000000000000 + i + 1}`; });
  const ws = XLSX.utils.json_to_sheet([r]),
    wb = XLSX.utils.book_new();
  // Kolom custom diformat sebagai TEKS (termasuk baris kosong di bawahnya) supaya nilai yang
  // diketik user - mis. NIK 16 digit atau nomor berawalan 0 - tidak diubah Excel jadi angka/3.2E+15.
  if (customCols.length) {
    const headers = Object.keys(r);
    const TEXT_ROWS = 1000;
    customCols.forEach(({ header }) => {
      const c = headers.indexOf(header);
      for (let rowIdx = 1; rowIdx <= TEXT_ROWS; rowIdx++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (rowIdx === 1) { ws[addr].t = "s"; ws[addr].z = "@"; }
        else ws[addr] = { t: "s", v: "", z: "@" };
      }
    });
    const range = XLSX.utils.decode_range(ws["!ref"]);
    range.e.r = Math.max(range.e.r, TEXT_ROWS);
    ws["!ref"] = XLSX.utils.encode_range(range);
  }
  XLSX.utils.book_append_sheet(wb, ws, "Template_Import");
  XLSX.writeFile(wb, "Template_Import_Peserta.xlsx");
};

window.closeGuestActionMenu = function () {
  document.getElementById("guest-action-menu")?.remove();
  if (window._closeGuestActionMenuHandler) {
    document.removeEventListener(
      "click",
      window._closeGuestActionMenuHandler,
      true,
    );
    window._closeGuestActionMenuHandler = null;
  }
};

window.toggleSelfPickup = function (checked) {
  const nameInput = document.getElementById("sig-name");
  const guest = window.guests.find((x) => x.id === window.currentSigGuestId);
  if (!nameInput) return;
  if (checked && guest) {
    nameInput.value = guest.nama;
    nameInput.disabled = true;
  } else {
    nameInput.value = "";
    nameInput.disabled = false;
  }
};

window.processExportExcel = function (type, sourceGuests, evt) {
  const seatColLabel = evt?.seatLabelType === "meja" ? "No Meja" : "No Kursi";
  const data = sourceGuests.map((g, i) => {
    const row = {
      No: i + 1,
      "Quest ID": g.id,
      "Nama Lengkap": g.nama,
      "Asal RS": g.rs,
      Jabatan: g.jabatan,
    };
    if (evt?.needsSeat !== false) row[seatColLabel] = g.kursi;
    if (evt?.needsHotel) {
      row["No Kamar"] = g.kamar || "-";
      if (type === "all")
        row.Kunci = g.kunciDiambil ? "Sudah Diambil" : "Belum";
    }
    addCustomColumns(row, g, evt);
    if (type === "all") row.Status = g.scanned ? "Hadir" : "Belum";
    row["Waktu Absen"] = g.scanTime || "-";
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data),
    wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(
    wb,
    type === "all" ? "List_Seluruh_Peserta.xlsx" : "Daftar_Hadir.xlsx",
  );
};

window.handleImportExcel = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const evt = eventForGuests();
  const reader = new FileReader();
  // BUG FIX: parsing XLSX dibungkus try/catch - kalau file yang diupload rusak, bukan
  // format Excel/CSV yang valid, atau terkunci password, XLSX.read() akan throw. Errornya
  // ditangkap & ditampilkan lewat toast, dan input file selalu direset (lihat finally di
  // bawah untuk jalur sinkron, dan resetInput() di jalur async lewat modal pilihan mode).
  reader.onload = function (e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), {
        type: "array",
      });
      const jsonData = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
      );
      if (jsonData.length === 0) {
        window.showToast("Format Excel salah.", "error");
        return;
      }

      // Saring baris valid LEBIH DULU (sebelum ditanya gabung/timpa) supaya jumlah yang
      // ditampilkan di modal pilihan benar-benar akurat, bukan sekadar total baris mentah file.
      const validRows = jsonData.filter(
        (row) =>
          guestText(row["Nama Lengkap"]).trim() &&
          guestText(row["Asal RS"]).trim(),
      );
      if (validRows.length === 0) {
        window.showToast("Format Excel salah.", "error");
        return;
      }

      const resetInput = () => {
        event.target.value = "";
      };

      if (window.guests.length > 0) {
        // Hitung berapa baris di file yang BENAR-BENAR peserta baru (belum ada di data
        // lama, dan belum muncul berulang di dalam file itu sendiri), sekaligus kumpulkan
        // detail baris yang terdeteksi duplikat (nama, asal RS, & Quest ID lama kalau
        // cocok dengan data yang sudah ada) supaya bisa ditampilkan ke admin lewat tombol
        // "Lihat Data" di modal. Baris duplikat TIDAK dicantumkan/diakumulasikan ke angka
        // "Data Baru" maupun "Jika Gabung" - supaya Sudah Ada + Data Baru selalu = Jika Gabung.
        const seenKeys = new Set(
          window.guests.map((g) => matchKey(g.nama, g.rs)),
        );
        const existingByKey = {};
        window.guests.forEach((g) => {
          const k = matchKey(g.nama, g.rs);
          if (!existingByKey[k]) existingByKey[k] = g;
        });
        let uniqueNewCount = 0;
        const duplicateRows = [];
        validRows.forEach((row) => {
          const key = matchKey(row["Nama Lengkap"], row["Asal RS"]);
          if (seenKeys.has(key)) {
            duplicateRows.push({
              nama: row["Nama Lengkap"],
              rs: row["Asal RS"],
              // null berarti duplikat di dalam file itu sendiri (bukan data lama)
              questId: existingByKey[key] ? existingByKey[key].id : null,
            });
          } else {
            seenKeys.add(key);
            uniqueNewCount++;
          }
        });

        // Event ini sudah punya data peserta -> tanyakan dulu mau digabung atau dihapus & diganti.
        window.openImportModeModal(
          uniqueNewCount,
          window.guests.length,
          window.guests.length + uniqueNewCount,
          duplicateRows,
          (mode) => {
            window.processExcelImport(validRows, evt, mode);
            resetInput();
          },
          resetInput,
        );
      } else {
        // Belum ada data sama sekali di event ini -> tidak ada yang bisa "ditimpa", langsung proses.
        window.processExcelImport(validRows, evt, "merge");
        resetInput();
      }
    } catch (err) {
      console.error("Gagal membaca/memproses file Excel:", err);
      window.showToast(
        window.currentLang === "id"
          ? "File Excel tidak bisa dibaca - pastikan formatnya .xlsx/.xls/.csv yang valid dan tidak terkunci password."
          : "Could not read the Excel file - make sure it is a valid, non password-protected .xlsx/.xls/.csv file.",
        "error",
      );
      event.target.value = "";
    }
  };
  reader.onerror = function () {
    console.error("FileReader gagal membaca file Excel:", reader.error);
    window.showToast(
      window.currentLang === "id"
        ? "Gagal membaca file! Coba lagi atau gunakan file lain."
        : "Failed to read the file! Please try again or use a different file.",
      "error",
    );
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
};

// Eksekusi import yang sesungguhnya, dipanggil setelah admin memilih mode di modal (atau
// langsung dengan mode 'merge' kalau event belum punya data sama sekali). mode 'replace'
// mengosongkan data peserta lama lebih dulu; mode 'merge' menambahkan data baru ke daftar
// yang sudah ada tanpa menghapus apa pun, dan melewati baris yang nama+asal RS-nya sudah
// sama persis dengan peserta yang ada (Quest ID lama tidak disentuh/di-generate ulang).
window.processExcelImport = async function (validRows, evt, mode) {
  if (mode === "replace") window.guests = [];
  // Kolom nomor bisa bernama "No Kursi" atau "No Meja" tergantung pilihan seatLabelType
  // event ini — dibaca fleksibel dari keduanya supaya file lama (sebelum fitur ini ada)
  // maupun template baru yang sesuai tetap terbaca dengan benar.
  const seatColLabel = evt?.seatLabelType === "meja" ? "No Meja" : "No Kursi";

  window.showProgressModal(
    window.t("btn_import"),
    window.currentLang === "id"
      ? "Memproses data peserta..."
      : "Processing participant data...",
  );
  let c = 0,
    skipped = 0,
    duplicateSkipped = 0;
  try {
    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx];
      try {
        const isDuplicate =
          mode === "merge" &&
          window.guests.some(
            (g) =>
              matchKey(g.nama, g.rs) ===
              matchKey(row["Nama Lengkap"], row["Asal RS"]),
          );
        if (isDuplicate) {
          duplicateSkipped++;
        } else {
          window.guests.push({
            id: window.generateGuestId(evt?.type),
            nama: String(row["Nama Lengkap"]).trim(),
            rs: String(row["Asal RS"]).trim(),
            jabatan: row["Jabatan"] || "-",
            kursi:
              evt?.needsSeat !== false
                ? row[seatColLabel] || row["No Kursi"] || row["No Meja"] || "-"
                : "-",
            kamar: evt?.needsHotel ? row["No Kamar"] || "-" : "-",
            customNumbers: readCustomNumbers(row, evt),
            kunciDiambil: false,
            pickupScanned: false,
            pickupScanTime: null,
            scanned: false,
            scanTime: null,
            created: Date.now(),
          });
          c++;
        }
      } catch (rowErr) {
        // Satu baris yang bermasalah/tidak terduga TIDAK BOLEH menghentikan proses
        // baris-baris lain yang masih valid - cukup dilewati & dihitung, jumlahnya
        // dilaporkan di toast akhir supaya admin tahu ada yang perlu dicek manual.
        console.error("Baris import dilewati karena error:", rowErr, row);
        skipped++;
      }
      if (idx % 15 === 0 || idx === validRows.length - 1) {
        window.updateProgressModal(idx + 1, validRows.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } finally {
    // finally supaya modal progress TETAP tertutup walau ada error tak terduga yang lolos
    // dari try-catch per baris di atas - jangan sampai layar tersangkut di modal loading.
    window.hideProgressModal();
  }
  if (c > 0) {
    const saved = saveGuests();
    window.renderTable();
    window.renderGenerateSideStats?.();
    if (saved) {
      let msg =
        mode === "replace"
          ? window.currentLang === "id"
            ? `${c} data peserta berhasil di-import (data lama telah dihapus & diganti).`
            : `${c} participant data imported (old data replaced).`
          : window.currentLang === "id"
            ? `${c} data peserta berhasil di-import (digabung dengan data lama).`
            : `${c} participant data imported and merged with existing data.`;
      if (duplicateSkipped > 0)
        msg +=
          window.currentLang === "id"
            ? ` ${duplicateSkipped} data dilewati karena sudah ada sebelumnya (Quest ID lama tidak berubah).`
            : ` ${duplicateSkipped} rows skipped because they already existed (existing Quest ID kept unchanged).`;
      if (skipped > 0)
        msg +=
          window.currentLang === "id"
            ? ` ${skipped} baris dilewati karena bermasalah.`
            : ` ${skipped} rows skipped due to errors.`;
      window.showToast(msg, "success");
    }
    // Kalau saveGuests() gagal, LS/Cache sudah menampilkan toast error-nya sendiri -
    // tidak perlu toast tambahan di sini.
  } else if (duplicateSkipped > 0) {
    // Tidak ada satupun peserta baru ditambahkan karena seluruh baris file ternyata
    // sudah cocok dengan data yang sudah ada - ini BUKAN error format, jadi tidak
    // memakai pesan "Format Excel salah".
    window.showToast(
      window.currentLang === "id"
        ? `Tidak ada data baru ditambahkan - seluruh ${duplicateSkipped} data pada file sudah ada sebelumnya.`
        : `No new data added - all ${duplicateSkipped} rows in the file already existed.`,
      "warning",
    );
  } else window.showToast("Format Excel salah.", "error");
};

window.renderImportDuplicateList = function () {
  const list = document.getElementById("import-mode-duplicate-list");
  if (!list) return;
  const rows = window.importModeDuplicateRows || [];
  list.innerHTML = rows
    .map(
      (r) =>
        `<div class="px-3 py-2 flex items-center justify-between gap-3 text-[12px]"><div class="min-w-0"><p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(r.nama)}</p><p class="text-slate-400 dark:text-slate-500 truncate">${esc(r.rs)}</p></div><span class="shrink-0 font-mono text-[10px] text-slate-400 dark:text-slate-500">${esc(r.questId || (window.currentLang === "id" ? "Duplikat di file" : "Duplicate in file"))}</span></div>`,
    )
    .join("");
};
