// EventQ - Participant registration, tables, attendance, QR actions and Excel I/O.
// Storage is intentionally accessed through LS only; LS owns persistence/error handling.

function saveGuests() {
  const id = window.appState?.currentEventId;
  if (!id) return false;
  const saved = LS.setGuests(id, window.guests || []);
  if (saved !== false && typeof window.broadcastGuestsChanged === "function") window.broadcastGuestsChanged(id);
  return saved !== false;
}
window.saveGuests = saveGuests;

const guestText = (v) => String(v ?? "");
const esc = (v) => guestText(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
const eventForGuests = () => LS.getEvents().find(e => e.id === window.appState?.currentEventId);
const can = key => typeof window.hasFeaturePerm !== "function" || window.hasFeaturePerm(key);
const nowTime = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function customValues(containerId) {
  if (typeof window.collectCustomNumberValues === "function") return window.collectCustomNumberValues(containerId);
  const out = {};
  document.getElementById(containerId)?.querySelectorAll("[data-custom-field-id]").forEach(el => {
    if (el.value.trim()) out[el.dataset.customFieldId] = el.value.trim();
  });
  return out;
}
function customDuplicate(evt, values, exclude) {
  if (typeof window.findDuplicateCustomNumberField === "function") return window.findDuplicateCustomNumberField(evt, values, exclude);
  for (const f of evt?.customNumberFields || []) {
    const value = guestText(values[f.id]).trim();
    if (!value) continue;
    const g = window.guests.find(x => x.id !== exclude && guestText(x.customNumbers?.[f.id]).trim() === value);
    if (g) return { label: f.label, value, guestName: g.nama };
  }
  return null;
}
function confirmAction(title, text, yes) {
  if (typeof window.openConfirmCustom === "function") window.openConfirmCustom(title, text, yes);
  else yes();
}

window.handleGenerateSubmit = function (e) {
  e.preventDefault();
  const name = document.getElementById("input-nama")?.value.trim() || "";
  const proceed = () => {
    const evt = eventForGuests();
    const values = customValues("container-custom-number-fields");
    const dup = customDuplicate(evt, values, null);
    if (dup) return confirmAction("Nomor Sudah Terpakai", `Nomor ${dup.label || "khusus"} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap lanjutkan?`, window.processGenerateGuest);
    window.processGenerateGuest();
  };
  if (name && window.guests.some(g => guestText(g.nama).trim().toLowerCase() === name.toLowerCase())) {
    return confirmAction(window.t?.("modal_dup_name_title") || "Nama Sudah Terdaftar", `Nama "${name}" sudah terdaftar. Tetap lanjutkan?`, proceed);
  }
  proceed();
};

window.processGenerateGuest = function () {
  const btn = document.getElementById("btn-submit-generate");
  const original = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memproses...`; }
  setTimeout(() => {
    const evt = eventForGuests();
    if (!evt) { if (btn) { btn.disabled = false; btn.innerHTML = original; } return; }
    const guest = {
      id: window.generateGuestId(evt.type),
      nama: document.getElementById("input-nama")?.value.trim() || "",
      rs: document.getElementById("input-rs")?.value.trim() || "",
      jabatan: document.getElementById("input-jabatan")?.value.trim() || "",
      kursi: evt.needsSeat !== false ? (document.getElementById("input-kursi")?.value.trim() || "-") : "-",
      kamar: evt.needsHotel ? (document.getElementById("input-kamar")?.value.trim() || "-") : "-",
      customNumbers: customValues("container-custom-number-fields"),
      kunciDiambil: false, pickupScanned: false, pickupScanTime: null,
      scanned: false, scanTime: null, created: Date.now()
    };
    window.guests.push(guest);
    if (saveGuests()) {
      document.getElementById("form-generate")?.reset();
      if (typeof window.renderCustomNumberFieldsForm === "function") window.renderCustomNumberFieldsForm(evt, "container-custom-number-fields", "custom-gen", {}, null);
      window.renderGenerateSideStats?.();
      window.showToast?.("Peserta berhasil ditambahkan!", "success");
      window.showQRCode?.(guest.id, guest.nama, guest.rs, guest.jabatan, guest.kursi);
    } else window.guests.pop();
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }, 300);
};

window.renderGenerateSideStats = function () {
  const el = document.getElementById("generate-side-total");
  if (el) el.innerText = window.guests.length;
};

window.renderDashboard = function () {
  const guests = window.guests || [], present = guests.filter(g => g.scanned).length;
  ["dash-total", "dash-hadir", "dash-persen"].forEach(id => { if (!document.getElementById(id)) return; });
  document.getElementById("dash-total")?.replaceChildren(document.createTextNode(guests.length));
  document.getElementById("dash-hadir")?.replaceChildren(document.createTextNode(present));
  document.getElementById("dash-persen")?.replaceChildren(document.createTextNode(`${guests.length ? Math.round(present / guests.length * 100) : 0}%`));
  const feedNew = document.getElementById("feed-new-guests"), feedAtt = document.getElementById("feed-attendances");
  if (feedNew) feedNew.innerHTML = guests.slice().reverse().slice(0, 5).map(g => `<div class="p-3 bg-slate-50 rounded-xl border flex justify-between"><span class="font-bold text-sm">${esc(g.nama)}<small class="block text-xs text-slate-500">${esc(g.rs)}</small></span><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Baru</span></div>`).join("");
  if (feedAtt) feedAtt.innerHTML = guests.filter(g => g.scanned).sort((a,b) => guestText(a.scanTime).localeCompare(guestText(b.scanTime))).slice(-5).reverse().map(g => `<div class="p-3 bg-slate-50 rounded-xl border flex justify-between"><span class="font-bold text-sm">${esc(g.nama)}<small class="block text-xs text-slate-500">${esc(g.rs)}</small></span><span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">${esc(g.scanTime)}</span></div>`).join("");
  if (typeof chartRS !== "undefined" && chartRS) chartRS.destroy();
  if (typeof chartStatus !== "undefined" && chartStatus) chartStatus.destroy();
  const rsCanvas = document.getElementById("chart-rs"), statusCanvas = document.getElementById("chart-status");
  if (!rsCanvas || !statusCanvas || typeof Chart === "undefined") return;
  const counts = {}; guests.forEach(g => counts[g.rs] = (counts[g.rs] || 0) + 1);
  let values = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if (document.getElementById("rs-chart-mode")?.value === "top5") values = values.slice(0, 5);
  chartRS = new Chart(rsCanvas.getContext("2d"), { type: "bar", data: { labels: values.map(x => x[0]), datasets: [{ data: values.map(x => x[1]), backgroundColor: "#6366f1", borderRadius: 5 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  chartStatus = new Chart(statusCanvas.getContext("2d"), { type: "doughnut", data: { labels: ["Hadir", "Belum"], datasets: [{ data: [present, guests.length - present], backgroundColor: ["#10b981", "#cbd5e1"], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "70%" } });
};

const SORTS = { nama_asc: ["nama", 1], nama_desc: ["nama", -1], rs_asc: ["rs", 1], rs_desc: ["rs", -1], jabatan_asc: ["jabatan", 1], jabatan_desc: ["jabatan", -1] };
function sortGuests(list, key) { const s = SORTS[key]; return s ? list.slice().sort((a,b) => s[1] * guestText(a[s[0]]).localeCompare(guestText(b[s[0]]), "id", { sensitivity: "base", numeric: true })) : list; }
function filteredGuests() {
  const q = (document.getElementById("search-list")?.value || "").toLowerCase(), status = document.getElementById("filter-status")?.value || "all";
  return window.guests.filter(g => [g.nama, g.id, g.rs].some(v => guestText(v).toLowerCase().includes(q)) && (status === "all" || (status === "hadir" ? g.scanned : !g.scanned)));
}
function selectedUI() {
  const set = window.selectedGuestIds || (window.selectedGuestIds = new Set());
  const indicator = document.getElementById("selected-guests-indicator"); if (indicator) indicator.style.display = set.size ? "inline-flex" : "none";
  const count = document.getElementById("selected-guests-count-text"); if (count) count.innerText = `${set.size} peserta dipilih`;
  const badge = document.getElementById("badge-print-selected-count"); if (badge) { badge.innerText = set.size; badge.style.display = set.size ? "inline-flex" : "none"; }
  const all = document.getElementById("checkbox-select-all-guests"), list = filteredGuests(), n = list.filter(g => set.has(g.id)).length;
  if (all) { all.checked = !!list.length && n === list.length; all.indeterminate = n > 0 && n < list.length; }
}
window.toggleGuestSelection = function (id, checked) { (window.selectedGuestIds || (window.selectedGuestIds = new Set()))[checked ? "add" : "delete"](id); selectedUI(); };
window.toggleSelectAllGuests = function (checked) { const set = window.selectedGuestIds || (window.selectedGuestIds = new Set()); filteredGuests().forEach(g => checked ? set.add(g.id) : set.delete(g.id)); window.renderTable(); };
window.clearGuestSelection = function () { window.selectedGuestIds?.clear(); window.renderTable(); };
window.updateGuestSelectionUI = selectedUI;

function actionMenu(guest) {
  const items = [];
  if (!guest.scanned && can("actionManual")) items.push(["fa-check", "Absen Manual", `window.markAttendanceManual('${esc(guest.id)}')`]);
  if (can("actionPreviewQR")) items.push(["fa-qrcode", "Preview QR", `window.showQRCode('${esc(guest.id)}','${esc(guest.nama)}','${esc(guest.rs)}','${esc(guest.jabatan)}','${esc(guest.kursi)}')`]);
  if (can("actionPrintQR")) items.push(["fa-print", "Cetak QR", `window.printSingleQR?.('${esc(guest.id)}')`]);
  if (can("actionEdit")) items.push(["fa-pen", "Edit", `window.openEditModal('${esc(guest.id)}')`]);
  if (can("actionDelete")) items.push(["fa-trash", "Hapus", `window.openConfirmModal('guest','${esc(guest.id)}')`]);
  return items.length ? `<div class="relative inline-flex"><button type="button" onclick="window.toggleGuestActionMenu?.('${esc(guest.id)}',this)" class="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>` : "";
}
function createGuestRow(guest, index) {
  const evt = eventForGuests(), hidden = evt?.hiddenColumns || [], tr = document.createElement("tr"); tr.className = "hover:bg-slate-50 transition-colors";
  const seat = evt?.needsSeat !== false && !hidden.includes("kursi") ? `<td class="px-5 py-3.5 text-sm">${esc(guest.kursi)}</td>` : "";
  const rs = hidden.includes("rs") ? "" : `<td class="px-5 py-3.5 text-sm">${esc(guest.rs)}</td>`;
  const jab = hidden.includes("jabatan") ? "" : `<td class="px-5 py-3.5 text-sm">${esc(guest.jabatan)}</td>`;
  let hotel = "";
  if (evt?.needsHotel) {
    if (!hidden.includes("kamar")) hotel += `<td class="px-5 py-3.5 text-sm">${esc(guest.kamar || "-")}</td>`;
    if (!hidden.includes("kunci")) hotel += `<td class="px-5 py-3.5 text-center"><input type="checkbox" onchange="window.toggleKey('${esc(guest.id)}',this.checked,this)" ${guest.kunciDiambil ? "checked" : ""} ${!guest.kamar || guest.kamar === "-" ? "disabled" : ""}></td>`;
  }
  const select = `<td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleGuestSelection('${esc(guest.id)}',this.checked)" ${window.selectedGuestIds?.has(guest.id) ? "checked" : ""}></td>`;
  const download = can("actionDownloadQR") ? `<button onclick="window.downloadSingleQR?.('${esc(guest.id)}','${esc(guest.rs)}','${esc(guest.nama)}')" class="w-8 h-8 text-purple-600" title="Download QR"><i class="fa-solid fa-download"></i></button>` : "";
  tr.innerHTML = `${select}<td class="px-5 py-3.5 text-sm">${index + 1}</td><td class="px-5 py-3.5 text-sm font-bold text-indigo-600">${esc(guest.id)}</td><td class="px-5 py-3.5 text-sm">${esc(guest.nama)}</td>${rs}${jab}${seat}${hotel}<td class="px-5 py-3.5">${guest.scanned ? "Hadir" : "Belum"}</td><td class="px-5 py-3.5 text-center">${download}${actionMenu(guest)}</td>`;
  return tr;
}
function createAttendedRow(guest, index) {
  const evt = eventForGuests(), hidden = evt?.hiddenColumns || [], tr = document.createElement("tr"); tr.className = "hover:bg-emerald-50/50 transition-colors";
  const cell = (key, val) => hidden.includes(key) ? "" : `<td class="px-5 py-3.5 text-sm">${esc(val)}</td>`;
  tr.innerHTML = `<td class="px-5 py-3.5 text-sm">${index + 1}</td><td class="px-5 py-3.5 text-sm font-bold text-emerald-600">${esc(guest.id)}</td><td class="px-5 py-3.5 text-sm">${esc(guest.nama)}</td>${cell("rs",guest.rs)}${cell("jabatan",guest.jabatan)}${evt?.needsSeat !== false ? cell("kursi",guest.kursi) : ""}${evt?.needsHotel ? cell("kamar",guest.kamar || "-") : ""}<td class="px-5 py-3.5 text-sm">${esc(guest.scanTime)}</td><td class="px-5 py-3.5 text-center"><button onclick="window.removeAttendance('${esc(guest.id)}')" class="text-xs text-red-600 border border-red-200 py-1.5 px-3 rounded-lg">Batal</button></td>`;
  return tr;
}
window.renderTable = function () {
  const tbody = document.getElementById("table-body"), attendedBody = document.getElementById("table-body-attended"); if (!tbody || !attendedBody) return;
  const search = (document.getElementById("search-attended")?.value || "").toLowerCase();
  const list = sortGuests(filteredGuests(), document.getElementById("sort-list")?.value || "default");
  const attended = sortGuests(window.guests.filter(g => g.scanned && [g.nama,g.id,g.rs].some(v => guestText(v).toLowerCase().includes(search))), document.getElementById("sort-attended")?.value || "default");
  const pageSize = 10; window.currentPageGuests = Math.max(1, Math.min(window.currentPageGuests || 1, Math.max(1, Math.ceil(list.length / pageSize)))); window.currentPageAttended = Math.max(1, Math.min(window.currentPageAttended || 1, Math.max(1, Math.ceil(attended.length / pageSize))));
  document.getElementById("total-guests") && (document.getElementById("total-guests").innerText = `Total: ${list.length}`); document.getElementById("total-attended") && (document.getElementById("total-attended").innerText = `Hadir: ${attended.length}`);
  tbody.replaceChildren(...list.slice((window.currentPageGuests-1)*pageSize, window.currentPageGuests*pageSize).map((g,i) => createGuestRow(g,(window.currentPageGuests-1)*pageSize+i)));
  attendedBody.replaceChildren(...attended.slice((window.currentPageAttended-1)*pageSize, window.currentPageAttended*pageSize).map((g,i) => createAttendedRow(g,(window.currentPageAttended-1)*pageSize+i)));
  document.getElementById("empty-state")?.classList.toggle("hidden", !!list.length); document.getElementById("empty-state-attended")?.classList.toggle("hidden", !!attended.length);
  window.renderPagination?.(list.length,pageSize,window.currentPageGuests,"pagination-list","changePageGuests"); window.renderPagination?.(attended.length,pageSize,window.currentPageAttended,"pagination-attended","changePageAttended"); selectedUI();
};

window.toggleGuestActionMenu = function (id, button) {
  document.getElementById("guest-action-menu")?.remove(); const g = window.guests.find(x => x.id === id); if (!g) return;
  const items = []; if (!g.scanned && can("actionManual")) items.push(["fa-check","Absen Manual",() => window.markAttendanceManual(id)]); if (can("actionPreviewQR")) items.push(["fa-qrcode","Preview QR",() => window.showQRCode(id,g.nama,g.rs,g.jabatan,g.kursi)]); if (can("actionPrintQR")) items.push(["fa-print","Cetak QR",() => window.printSingleQR?.(id)]); if (can("actionEdit")) items.push(["fa-pen","Edit",() => window.openEditModal(id)]); if (can("actionDelete")) items.push(["fa-trash","Hapus",() => window.openConfirmModal("guest",id)]); if (!items.length) return;
  const menu = document.createElement("div"); menu.id = "guest-action-menu"; menu.className = "fixed z-[90] w-44 bg-white border rounded-xl shadow-xl py-1"; items.forEach(([icon,label,fn]) => { const b=document.createElement("button"); b.className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"; b.innerHTML=`<i class="fa-solid ${icon} w-5"></i>${label}`; b.onclick=()=>{menu.remove();fn();}; menu.appendChild(b); }); document.body.appendChild(menu); const r=button.getBoundingClientRect(); menu.style.left=`${Math.max(8,r.right-176)}px`; menu.style.top=`${r.bottom+5}px`;
};
window.markAttendanceManual = function (id) { const g=window.guests.find(x=>x.id===id); if(!g||g.scanned||!can("actionManual"))return; confirmAction("Absen Peserta Ini?",`Kehadiran untuk ${g.nama} akan dicatat sekarang.`,()=>{g.scanned=true;g.scanTime=nowTime();if(saveGuests()){window.renderTable();window.renderScanStats?.();window.showToast?.(`Selamat datang, ${g.nama}! Kehadiran Anda tercatat.`,`success`);}}); };
window.markAllAttendance = function () { if(!can("markAllAttendance"))return; const a=window.guests.filter(g=>!g.scanned); if(!a.length)return; confirmAction("Absen Semua Peserta?",`${a.length} peserta akan ditandai hadir.`,()=>{const t=nowTime();a.forEach(g=>{g.scanned=true;g.scanTime=t;});saveGuests();window.renderTable();}); };
window.cancelAllAttendance = function () { if(!can("cancelAllAttendance"))return; const a=window.guests.filter(g=>g.scanned); if(!a.length)return; confirmAction("Batalkan Absen Semua?",`${a.length} status hadir akan dibatalkan.`,()=>{a.forEach(g=>{g.scanned=false;g.scanTime=null;});saveGuests();window.renderTable();}); };
window.removeAttendance = function (id) { const g=window.guests.find(x=>x.id===id); if(!g)return; confirmAction("Batalkan Status Kehadiran?",`Status hadir untuk ${g.nama} akan dibatalkan.`,()=>{g.scanned=false;g.scanTime=null;saveGuests();window.renderTable();window.showToast?.("Status absen dibatalkan","warning");}); };

window.openEditModal = function (id) { const g=window.guests.find(x=>x.id===id),evt=eventForGuests();if(!g)return; document.getElementById("edit-guest-id").value=id; document.getElementById("edit-nama").value=g.nama; document.getElementById("edit-rs").value=g.rs; document.getElementById("edit-jabatan").value=g.jabatan; document.getElementById("edit-kursi").value=g.kursi === "-" ? "" : g.kursi; document.getElementById("edit-kamar").value=g.kamar === "-" ? "" : g.kamar || ""; window.renderCustomNumberFieldsForm?.(evt,"container-edit-custom-number-fields","custom-edit",g.customNumbers||{},id); window.openModalAnimated?.("modal-edit"); };
window.handleEditSubmit = function (e) { e.preventDefault(); const id=document.getElementById("edit-guest-id").value,g=window.guests.find(x=>x.id===id),evt=eventForGuests();if(!g||!evt)return;const values=customValues("container-edit-custom-number-fields"),dup=customDuplicate(evt,values,id);const apply=()=>{g.nama=document.getElementById("edit-nama").value.trim();g.rs=document.getElementById("edit-rs").value.trim();g.jabatan=document.getElementById("edit-jabatan").value.trim();g.kursi=evt.needsSeat!==false?(document.getElementById("edit-kursi").value||"-"):"-";g.kamar=evt.needsHotel?(document.getElementById("edit-kamar").value||"-"):"-";g.customNumbers=values;saveGuests();window.closeModalAnimated?.("modal-edit");window.renderTable();window.showToast?.("Data diperbarui!","success");};if(dup)confirmAction("Nomor Sudah Terpakai",`Nomor ${dup.label} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap simpan?`,apply);else apply(); };

window.findLinkedGuests = function (guest) { const room=guestText(guest.kamar).trim(),rs=guestText(guest.rs).trim().toLowerCase();return room&&room!=="-"&&rs?window.guests.filter(x=>x.id!==guest.id&&guestText(x.kamar).trim()===room&&guestText(x.rs).trim().toLowerCase()===rs):[]; };
window.toggleKey = function (id, checked, el) { const g=window.guests.find(x=>x.id===id),evt=eventForGuests();if(!g)return;if(checked){window.currentSigGuestId=id;window.tempCheckboxElement=el;window.currentSigRequiresSignature=evt?.needsKeySignature!==false;document.getElementById("sig-name") && (document.getElementById("sig-name").value="");window.openModalAnimated?.("modal-signature");}else{if(el)el.checked=true;confirmAction("Batalkan Bukti Pengambilan Kunci?",`Bukti pengambilan kunci ${g.nama} akan dibatalkan.`,()=>{const linked=window.findLinkedGuests(g);[g,...linked].forEach(x=>{x.kunciDiambil=false;x.kunciDiambilOleh=null;x.kunciSignature=null;});saveGuests();window.renderTable();});}};

window.createQRCanvas = window.createQRCanvas || undefined;
window.showQRCode = window.showQRCode || function(id,nama,rs,jabatan,kursi){const c=document.getElementById("qrcode-container");if(!c||typeof QRCode==="undefined")return;c.innerHTML="";new QRCode(c,{text:id,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});document.getElementById("modal-qr-name")?.replaceChildren(document.createTextNode(nama));document.getElementById("modal-qr-rs")?.replaceChildren(document.createTextNode(rs||"-"));document.getElementById("modal-qr-jabatan")?.replaceChildren(document.createTextNode(jabatan||"-"));document.getElementById("modal-qr-kursi")?.replaceChildren(document.createTextNode(kursi&&kursi!=="-"?kursi:"Tidak Terdaftar"));window.openModalAnimated?.("modal-qr");};
window.downloadSingleQR = async function(id,rs,nama){if(typeof window.createQRCanvas!=="function")return window.showToast?.("Fitur QR belum siap","error");const url=await window.createQRCanvas(id),a=document.createElement("a");a.href=url;a.download=`[${rs}] ${nama}.png`;a.click();};
window.bulkDownloadQR = async function(){if(!window.guests.length)return window.showToast?.("Tidak ada data peserta!","error");if(typeof window.createQRCanvas!=="function")return;window.showToast?.("Mempersiapkan Bulk Download...","info");const zip=new JSZip(),folder=zip.folder("QRCodes_EventQ");for(const g of window.guests){const u=await window.createQRCanvas(g.id);folder.file(`[${g.rs}] ${g.nama}.png`,u.split(",")[1],{base64:true});}saveAs(await zip.generateAsync({type:"blob"}),"QRCodes_EventQ.zip");window.showToast?.("Download Selesai!","success");};

window.exportExcel = function(type){if(!window.guests.length)return window.showToast?.("Tidak ada data!","error");const evt=eventForGuests(),source=type==="all"?window.guests:window.guests.filter(g=>g.scanned),seat=evt?.seatLabelType==="meja"?"No Meja":"No Kursi";const rows=source.map((g,i)=>{const r={No:i+1,"Quest ID":g.id,"Nama Lengkap":g.nama,"Asal RS":g.rs,Jabatan:g.jabatan};if(evt?.needsSeat!==false)r[seat]=g.kursi;if(evt?.needsHotel)r["No Kamar"]=g.kamar||"-";if(type==="all")r.Status=g.scanned?"Hadir":"Belum";r["Waktu Absen"]=g.scanTime||"-";return r;});const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Data");XLSX.writeFile(wb,type==="all"?"List_Seluruh_Peserta.xlsx":"Daftar_Hadir.xlsx");};
window.downloadTemplate=function(){const e=eventForGuests(),r={"Nama Lengkap":"Dr. Andini","Asal RS":"RS Bunda",Jabatan:"Spesialis Anak"};if(!e||e.needsSeat!==false)r[e?.seatLabelType==="meja"?"No Meja":"No Kursi"]="VVIP-1";if(e?.needsHotel)r["No Kamar"]="201";const ws=XLSX.utils.json_to_sheet([r]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Template_Import");XLSX.writeFile(wb,"Template_Import_Peserta.xlsx");};

window.closeGuestActionMenu = function () {
  document.getElementById("guest-action-menu")?.remove();
  if (window._closeGuestActionMenuHandler) {
    document.removeEventListener("click", window._closeGuestActionMenuHandler, true);
    window._closeGuestActionMenuHandler = null;
  }
};

window.toggleSelfPickup = function (checked) {
  const nameInput = document.getElementById("sig-name");
  const guest = window.guests.find((x) => x.id === window.currentSigGuestId);
  if (!nameInput) return;
  if (checked && guest) { nameInput.value = guest.nama; nameInput.disabled = true; }
  else { nameInput.value = ""; nameInput.disabled = false; }
};

window.processExportExcel = function (type, sourceGuests, evt) {
  const seatColLabel = evt?.seatLabelType === "meja" ? "No Meja" : "No Kursi";
  const data = sourceGuests.map((g, i) => {
    const row = { No: i + 1, "Quest ID": g.id, "Nama Lengkap": g.nama, "Asal RS": g.rs, Jabatan: g.jabatan };
    if (evt?.needsSeat !== false) row[seatColLabel] = g.kursi;
    if (evt?.needsHotel) { row["No Kamar"] = g.kamar || "-"; if (type === "all") row.Kunci = g.kunciDiambil ? "Sudah Diambil" : "Belum"; }
    if (type === "all") row.Status = g.scanned ? "Hadir" : "Belum";
    row["Waktu Absen"] = g.scanTime || "-";
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, type === "all" ? "List_Seluruh_Peserta.xlsx" : "Daftar_Hadir.xlsx");
};


window.handleImportExcel = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const evt = eventForGuests();
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const validRows = rows.filter(row => guestText(row['Nama Lengkap']).trim() && guestText(row['Asal RS']).trim());
      if (!validRows.length) throw new Error('invalid');
      const existing = new Set(window.guests.map(g => window.guestMatchKey?.(g.nama, g.rs) || `${g.nama}|${g.rs}`));
      let added = 0, skipped = 0;
      validRows.forEach(row => {
        const nama = String(row['Nama Lengkap']).trim();
        const rs = String(row['Asal RS']).trim();
        const key = window.guestMatchKey?.(nama, rs) || `${nama}|${rs}`;
        if (existing.has(key)) { skipped++; return; }
        existing.add(key);
        window.guests.push({
          id: window.generateGuestId(evt.type), nama, rs,
          jabatan: row.Jabatan || '-',
          kursi: evt.needsSeat !== false ? (row['No Kursi'] || row['No Meja'] || '-') : '-',
          kamar: evt.needsHotel ? (row['No Kamar'] || '-') : '-',
          customNumbers: {}, kunciDiambil: false, pickupScanned: false,
          pickupScanTime: null, scanned: false, scanTime: null, created: Date.now()
        });
        added++;
      });
      if (added && saveGuests()) {
        window.renderTable(); window.renderGenerateSideStats?.();
        window.showToast(`${added} data di-import!${skipped ? ` ${skipped} duplikat dilewati.` : ''}`, 'success');
      } else if (skipped) window.showToast('Semua data sudah ada.', 'warning');
    } catch (err) {
      console.error('Gagal membaca file Excel:', err);
      window.showToast('Format Excel salah atau file tidak dapat dibaca.', 'error');
    } finally { event.target.value = ''; }
  };
  reader.onerror = () => { event.target.value = ''; window.showToast('Gagal membaca file!', 'error'); };
  reader.readAsArrayBuffer(file);
};

window.renderImportDuplicateList = function () {
  const list = document.getElementById("import-mode-duplicate-list");
  if (!list) return;
  const rows = window.importModeDuplicateRows || [];
  list.innerHTML = rows.map((r) => `<div class="px-3 py-2 flex items-center justify-between gap-3 text-[12px]"><div class="min-w-0"><p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(r.nama)}</p><p class="text-slate-400 dark:text-slate-500 truncate">${esc(r.rs)}</p></div><span class="shrink-0 font-mono text-[10px] text-slate-400 dark:text-slate-500">${esc(r.questId || (window.currentLang === "id" ? "Duplikat di file" : "Duplicate in file"))}</span></div>`).join("");
};
