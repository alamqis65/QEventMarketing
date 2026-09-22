// EventQ - Event library, CRUD, access sharing, duplication, and event configuration

const HIDEABLE_COLUMN_KEYS = ['rs', 'jabatan', 'kursi', 'kamar', 'kunci'];
const MAX_CUSTOM_NUMBER_FIELDS = 10;

// Header clock/date shown in the event library.
window.updateHeaderDateTime = function () {
  const el = document.getElementById('header-datetime-text');
  if (!el) return;
  const now = new Date();
  const locale = window.currentLang === 'en' ? 'en-US' : 'id-ID';
  const dayDate = now.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  el.innerText = `${dayDate} • ${time}`;
};

function loadLibrary() {
  if (!window.appState.currentUser) return;
  const name = document.getElementById('user-display-name');
  if (name) name.innerText = window.appState.currentUser.name;
  if (typeof updateProfilePicUI === 'function') updateProfilePicUI();
  switchMainViewAnimated('view-library');
  const content = document.getElementById('library-main-content');
  if (content) { content.classList.remove('library-enter'); void content.offsetWidth; content.classList.add('library-enter'); }
  if (window.updateHeaderDateTime) window.updateHeaderDateTime();
  if (window.applyFeaturePermissions) window.applyFeaturePermissions();
  if (window.updateLibraryViewToggleUI) window.updateLibraryViewToggleUI();
  if (window.updateLibraryFilterSortUI) window.updateLibraryFilterSortUI();
  renderEvents();
}
window.loadLibrary = loadLibrary;

window.setLibraryViewMode = function(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  window.libraryViewMode = mode;
  LS.setSetting('library_view_mode', mode);
  window.updateLibraryViewToggleUI && window.updateLibraryViewToggleUI();
  renderEvents();
};
window.updateLibraryViewToggleUI = function() {
  const grid = document.getElementById('btn-view-grid'), list = document.getElementById('btn-view-list');
  if (grid) grid.classList.toggle('tab-active', window.libraryViewMode === 'grid');
  if (list) list.classList.toggle('tab-active', window.libraryViewMode === 'list');
};
window.setLibraryFilterCategory = function(value) {
  window.libraryFilterCategory = value || 'all'; LS.setSetting('library_filter_category', window.libraryFilterCategory);
  window.currentPageEvents = 1; renderEvents();
};
window.setLibrarySortMode = function(value) {
  window.librarySortMode = value || 'default'; LS.setSetting('library_sort_mode', window.librarySortMode); renderEvents();
};
window.updateLibraryFilterSortUI = function() {
  const f = document.getElementById('filter-library-category'), s = document.getElementById('sort-library');
  if (f) f.value = window.libraryFilterCategory || 'all';
  if (s) s.value = window.librarySortMode || 'default';
};

function renderEvents() {
  const container = document.getElementById('event-list-container');
  if (!container || !window.appState.currentUser) return;
  const role = window.appState.currentUser.role;
  let events = LS.getEvents();
  if (role !== 'admin') events = events.filter(e => (e.accessList || []).includes(window.appState.currentUser.username));
  const search = (document.getElementById('search-library')?.value || '').toLowerCase();
  const category = document.getElementById('filter-library-category')?.value || window.libraryFilterCategory || 'all';
  if (search) events = events.filter(e => (e.name || '').toLowerCase().includes(search));
  if (category !== 'all') events = events.filter(e => e.type === category);
  const sort = document.getElementById('sort-library')?.value || window.librarySortMode || 'default';
  if (sort === 'az') events = [...events].sort((a,b) => (a.name || '').localeCompare(b.name || '', 'id', {sensitivity:'base'}));
  if (sort === 'za') events = [...events].sort((a,b) => (b.name || '').localeCompare(a.name || '', 'id', {sensitivity:'base'}));
  ['btn-lib-settings','btn-lib-create'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display=role==='admin'?'flex':'none'; });
  const tools = document.getElementById('btn-lib-tools');
  if (tools && window.applyFeaturePermissions) window.applyFeaturePermissions();
  const total = document.getElementById('total-events'); if (total) total.innerText = `Total: ${events.length}`;
  container.innerHTML = '';
  const list = window.libraryViewMode === 'list';
  container.className = list ? 'flex flex-col gap-3 w-full content-start min-h-[500px]' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 w-full content-start items-stretch min-h-[500px]';
  const perPage = 8, pages = Math.ceil(events.length / perPage);
  if (pages && window.currentPageEvents > pages) window.currentPageEvents = pages;
  const shown = events.slice((window.currentPageEvents - 1) * perPage, window.currentPageEvents * perPage);
  const empty = document.getElementById('empty-event-state');
  if (!events.length) {
    empty?.classList.remove('hidden');
    const filtered = !!search || category !== 'all';
    const btn = document.getElementById('empty-event-btn'); if (btn) btn.style.display = role === 'admin' && !filtered ? 'inline-flex' : 'none';
    if (filtered) { document.getElementById('empty-event-title').innerText = window.t('txt_no_event_filtered'); document.getElementById('empty-event-sub').innerText = window.t('txt_no_event_filtered_sub'); }
    else if (role === 'public') { document.getElementById('empty-event-title').innerText = 'Belum ada event'; document.getElementById('empty-event-sub').innerText = 'Anda belum diberikan akses ke event manapun.'; }
    else { document.getElementById('empty-event-title').innerText = window.t('txt_no_event'); document.getElementById('empty-event-sub').innerText = window.t('txt_no_event_sub'); }
  } else {
    empty?.classList.add('hidden');
    shown.forEach(evt => {
      const div = document.createElement('div'), guests = LS.getGuests(evt.id);
      const date = evt.date ? new Date(evt.date).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
      const logo = evt.logo ? `<img src="${evt.logo}" class="w-full h-full object-contain bg-white rounded-xl">` : '<i class="fa-solid fa-calendar-check"></i>';
      const meta = `<span class="font-medium"><i class="fa-regular fa-clock w-4"></i> ${date}</span>${evt.type ? `<span class="font-medium"><i class="fa-solid fa-tag w-4"></i> ${evt.type === 'Lain-lain' ? evt.typeDetail : evt.type}</span>` : ''}${evt.needsHotel ? '<span class="font-medium text-amber-600"><i class="fa-solid fa-hotel w-4"></i> Penginapan/Hotel</span>' : ''}${evt.needsSeat !== false ? `<span class="font-medium text-indigo-500"><i class="fa-solid ${evt.seatLabelType === 'meja' ? 'fa-utensils' : 'fa-chair'} w-4"></i> Penempatan ${evt.seatLabelType === 'meja' ? 'Meja' : 'Kursi'}</span>` : ''}`;
      const actions = role === 'admin' ? `<button onclick="event.stopPropagation();window.openShareModal('${evt.id}')" class="text-indigo-500 bg-indigo-50 p-2 rounded-lg" title="Bagikan Akses"><i class="fa-solid fa-share-nodes"></i></button><button onclick="event.stopPropagation();window.editEvent('${evt.id}')" class="text-amber-500 bg-amber-50 p-2 rounded-lg" title="Edit Event"><i class="fa-solid fa-pen"></i></button><button onclick="event.stopPropagation();window.duplicateEvent('${evt.id}')" class="text-cyan-500 bg-cyan-50 p-2 rounded-lg" title="Duplikat Event"><i class="fa-solid fa-copy"></i></button><button onclick="event.stopPropagation();window.openConfirmModal('event','${evt.id}')" class="text-red-500 bg-red-50 p-2 rounded-lg" title="Hapus Event"><i class="fa-solid fa-trash"></i></button>` : '';
      if (list) {
        div.className='w-full bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 relative flex items-center gap-3 sm:gap-5';
        div.innerHTML=`<div onclick="window.enterApp('${evt.id}')" class="flex items-center gap-3 sm:gap-5 flex-1 min-w-0 cursor-pointer"><div class="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl overflow-hidden">${logo}</div><div class="min-w-0 flex-1"><h3 class="text-base sm:text-lg font-bold text-slate-800 truncate">${evt.name}</h3><div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">${meta}</div></div><p class="hidden md:block text-sm font-semibold text-indigo-600 whitespace-nowrap">${guests.length} Peserta</p></div><div class="flex gap-1.5 pl-2 border-l">${actions}</div>`;
      } else {
        div.className='w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative group cursor-pointer flex flex-col min-h-[220px]';
        div.innerHTML=`<div class="absolute top-4 right-4 flex gap-2 z-10">${actions}</div><div onclick="window.enterApp('${evt.id}')" class="flex-1 flex flex-col"><div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-2xl mb-4 overflow-hidden">${logo}</div><h3 class="text-xl font-bold text-slate-800 mb-1 leading-tight ${role==='admin'?'pr-32':''}">${evt.name}</h3><div class="text-xs text-slate-500 space-y-1 mt-2 mb-4">${meta}</div><p class="text-sm font-semibold text-indigo-600 mt-auto pt-4 border-t">${guests.length} Peserta Terdaftar</p></div>`;
      }
      container.appendChild(div);
    });
  }
  window.renderPagination(events.length, perPage, window.currentPageEvents, 'pagination-events', 'changePageEvents');
}
window.renderEvents = renderEvents;

window.openEventModal = function() {
  ['event-id','event-name','event-date','event-logo-base64'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('event-type').value='Rumah Sakit'; document.getElementById('event-needs-seat').checked=true; document.getElementById('event-needs-hotel').checked=false;
  const key=document.getElementById('event-needs-key-signature'); if(key) key.checked=true;
  const seat=document.querySelector('input[name="event-seat-label-type"][value="kursi"]'); if(seat) seat.checked=true;
  document.getElementById('event-logo-file').value=''; document.getElementById('event-custom-number-fields-list')?.replaceChildren();
  window.setEventHiddenColumnsToForm([]); window.toggleEventTypeDetail(); window.toggleSeatLabelOption?.(); window.toggleHotelKeySignatureOption?.(); window.hideEventLogoFileInfo?.();
  document.getElementById('modal-event-title').innerText=window.t('modal_event_title'); window.openModalAnimated('modal-event');
};
window.editEvent = function(id) {
  const e=LS.getEvents().find(x=>x.id===id); if(!e) return;
  document.getElementById('event-id').value=e.id; document.getElementById('event-name').value=e.name; document.getElementById('event-type').value=e.type||'Rumah Sakit'; document.getElementById('event-type-detail').value=e.typeDetail||''; document.getElementById('event-date').value=e.date||''; document.getElementById('event-needs-seat').checked=e.needsSeat!==false; document.getElementById('event-needs-hotel').checked=!!e.needsHotel;
  const key=document.getElementById('event-needs-key-signature'); if(key) key.checked=e.needsKeySignature!==false;
  const seat=document.querySelector(`input[name="event-seat-label-type"][value="${e.seatLabelType==='meja'?'meja':'kursi'}"]`); if(seat) seat.checked=true;
  document.getElementById('event-logo-file').value=''; document.getElementById('event-logo-base64').value=e.logo||''; window.toggleEventTypeDetail(); window.toggleSeatLabelOption?.(); window.toggleHotelKeySignatureOption?.(); window.setEventHiddenColumnsToForm(e.hiddenColumns);
  const list=document.getElementById('event-custom-number-fields-list'); if(list){list.innerHTML='';(e.customNumberFields||[]).forEach(f=>window.addEventCustomNumberFieldRow(f.label,f.id));}
  document.getElementById('modal-event-title').innerText='Edit Event'; window.openModalAnimated('modal-event');
};
window.toggleEventTypeDetail=function(){ document.getElementById('event-type-detail-container')?.classList.toggle('hidden',document.getElementById('event-type').value!=='Lain-lain'); };
window.resetTempEventLogo=function(){document.getElementById('event-logo-file').value='';document.getElementById('event-logo-base64').value='';window.hideEventLogoFileInfo?.();window.showToast('Logo disetel ke default','info');};

window.addEventCustomNumberFieldRow=function(label='',id=null){const list=document.getElementById('event-custom-number-fields-list');if(!list||list.children.length>=MAX_CUSTOM_NUMBER_FIELDS)return window.showToast(`Maksimal ${MAX_CUSTOM_NUMBER_FIELDS} jenis nomor unik.`,'warning');const row=document.createElement('div');row.className='flex items-center gap-2 custom-number-field-row';row.dataset.fieldId=id||`cf_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;row.innerHTML=`<i class="fa-solid fa-hashtag text-slate-400"></i><input type="text" class="custom-number-field-label flex-1 px-3 py-2 text-sm border rounded-lg" maxlength="40" value="${String(label).replace(/"/g,'&quot;')}"><button type="button" onclick="window.removeEventCustomNumberFieldRow(this)" class="w-8 h-8 text-red-500"><i class="fa-solid fa-trash"></i></button>`;list.appendChild(row);};
window.removeEventCustomNumberFieldRow=function(btn){btn.closest('.custom-number-field-row')?.remove();};
window.getEventCustomNumberFieldsFromForm=function(){return [...document.querySelectorAll('#event-custom-number-fields-list .custom-number-field-row')].map(r=>({id:r.dataset.fieldId,label:r.querySelector('.custom-number-field-label').value.trim()})).filter(f=>f.label);};
window.getEventHiddenColumnsFromForm=function(){const map={rs:'event-hide-col-rs',jabatan:'event-hide-col-jabatan',kursi:'event-hide-col-kursi',kamar:'event-hide-col-kamar',kunci:'event-hide-col-kunci'};return HIDEABLE_COLUMN_KEYS.filter(k=>document.getElementById(map[k])?.checked);};
window.setEventHiddenColumnsToForm=function(cols){const map={rs:'event-hide-col-rs',jabatan:'event-hide-col-jabatan',kursi:'event-hide-col-kursi',kamar:'event-hide-col-kamar',kunci:'event-hide-col-kunci'};const a=Array.isArray(cols)?cols:[];HIDEABLE_COLUMN_KEYS.forEach(k=>{const e=document.getElementById(map[k]);if(e)e.checked=a.includes(k);});};
window.applyHiddenColumnsToTableHeaders=function(evt){const h=Array.isArray(evt?.hiddenColumns)?evt.hiddenColumns:[], map={rs:['th-list-rs-col','th-att-rs-col'],jabatan:['th-list-jabatan-col','th-att-jabatan-col']};Object.keys(map).forEach(k=>map[k].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=h.includes(k)?'none':'table-cell';}));};
window.renderCustomNumberFieldsForm=function(evt,containerId,prefix,values={},exclude){const c=document.getElementById(containerId),fields=evt?.customNumberFields||[];if(!c)return;c.innerHTML=fields.map(f=>{const id=`${prefix}-${f.id}`,v=String(values[f.id]||'').replace(/"/g,'&quot;');return `<div><label class="block text-sm font-semibold mb-1.5">${f.label} <span class="text-xs font-normal">(Opsional)</span></label><input type="text" id="${id}" data-custom-field-id="${f.id}" value="${v}" oninput="window.checkCustomNumberFieldDuplicate(this,${exclude?`'${exclude}'`:'null'})" class="w-full px-4 py-2.5 border rounded-xl"><p id="${id}-dup-warning" class="hidden text-xs text-amber-600"></p></div>`;}).join('');};
window.collectCustomNumberValues=function(id){const o={};document.getElementById(id)?.querySelectorAll('[data-custom-field-id]').forEach(e=>{if(e.value.trim())o[e.dataset.customFieldId]=e.value.trim();});return o;};
window.checkCustomNumberFieldDuplicate=function(input,exclude){const warning=document.getElementById(`${input.id}-dup-warning`),v=input.value.trim();if(!warning)return;const g=window.guests.find(x=>x.id!==exclude&&x.customNumbers?.[input.dataset.customFieldId]?.toString().trim()===v);warning.innerText=g?`Sudah dipakai oleh ${g.nama}`:'';warning.classList.toggle('hidden',!g);};
window.findDuplicateCustomNumberField=function(evt,map,exclude){for(const f of (evt?.customNumberFields||[])){const v=(map[f.id]||'').trim(),g=window.guests.find(x=>x.id!==exclude&&x.customNumbers?.[f.id]?.toString().trim()===v);if(v&&g)return {fieldId:f.id,label:f.label,value:v,guestName:g.nama,guestId:g.id};}return null;};

window.duplicateEvent=function(id){const gs=LS.getGuests(id);if(!gs.length)return window.executeDuplicateEvent(id,false);window.openDuplicateEventModeModal(id,gs.length);};
window.openDuplicateEventModeModal=function(id,count){window.pendingDuplicateEventId=id;const e=document.getElementById('duplicate-event-guest-count');if(e)e.innerText=count;window.openModalAnimated('modal-duplicate-event-mode');};
window.cancelDuplicateEventMode=function(){window.closeModalAnimated('modal-duplicate-event-mode');window.pendingDuplicateEventId=null;};
window.chooseDuplicateEventMode=function(copy){const id=window.pendingDuplicateEventId;window.cancelDuplicateEventMode();if(id)window.executeDuplicateEvent(id,copy);};
window.executeDuplicateEvent=function(id,include){const original=LS.getEvents().find(e=>e.id===id);if(!original)return;const evt={...original,id:window.generateEventId(),name:`${original.name} (Salinan)`,customNumberFields:JSON.parse(JSON.stringify(original.customNumberFields||[])),hiddenColumns:[...(original.hiddenColumns||[])],owner:window.appState.currentUser.username,accessList:[],updatedAt:Date.now()};const events=LS.getEvents();events.push(evt);if(!LS.setEvents(events))return;let ok=true,count=0;if(include){const origGuests=LS.getGuests(id);const newGuests=[];for(const g of origGuests){newGuests.push({id:window.generateGuestId(evt.type,newGuests),nama:g.nama,rs:g.rs,jabatan:g.jabatan,kursi:g.kursi,kamar:g.kamar,customNumbers:g.customNumbers?JSON.parse(JSON.stringify(g.customNumbers)):{},kunciDiambil:false,pickupScanned:false,pickupScanTime:null,scanned:false,scanTime:null,created:Date.now()});}count=newGuests.length;ok=LS.setGuests(evt.id,newGuests);}renderEvents();if(ok)window.showToast(include?`Event berhasil diduplikat beserta ${count} data peserta (status direset).`:'Event berhasil diduplikat! Data peserta tidak ikut disalin.','success');};

window.handleEventSubmit=function(e){e.preventDefault();const id=document.getElementById('event-id').value,name=document.getElementById('event-name').value.trim(),type=document.getElementById('event-type').value,typeDetail=document.getElementById('event-type-detail').value,date=document.getElementById('event-date').value,logo=document.getElementById('event-logo-base64').value,needsSeat=document.getElementById('event-needs-seat').checked,seatLabelType=document.querySelector('input[name="event-seat-label-type"]:checked')?.value||'kursi',needsHotel=document.getElementById('event-needs-hotel').checked,needsKeySignature=document.getElementById('event-needs-key-signature')?.checked!==false,customNumberFields=window.getEventCustomNumberFieldsFromForm(),hiddenColumns=window.getEventHiddenColumnsFromForm();const events=LS.getEvents();if(id){const i=events.findIndex(x=>x.id===id);if(i<0)return;events[i]={...events[i],name,type,typeDetail,date,logo,needsSeat,seatLabelType,needsHotel,needsKeySignature,customNumberFields,hiddenColumns,updatedAt:Date.now()};LS.setEvents(events);if(window.appState.currentEventId===id){window.applyHiddenColumnsToTableHeaders(events[i]);window.renderTable?.();}window.showToast('Event diperbarui!','success');}else{const evt={id:window.generateEventId(),name,type,typeDetail,date,logo,needsSeat,seatLabelType,needsHotel,needsKeySignature,customNumberFields,hiddenColumns,owner:window.appState.currentUser.username,accessList:[],updatedAt:Date.now()};events.push(evt);LS.setEvents(events);window.closeModalAnimated('modal-event');window.enterApp(evt.id);window.showToast('Event dibuat!','success');return;}window.closeModalAnimated('modal-event');renderEvents();};

window.openShareModal=function(id){document.getElementById('share-event-id').value=id;const e=LS.getEvents().find(x=>x.id===id),users=LS.getUsers().filter(u=>u.role!=='admin'&&u.username!==window.appState.currentUser.username),c=document.getElementById('share-user-list');document.getElementById('search-share-users')?.value&&(document.getElementById('search-share-users').value='');c.innerHTML=users.length?'': '<p class="text-sm text-slate-500 text-center py-4">Tidak ada user public lain yang terdaftar.</p>';users.forEach(u=>{c.innerHTML+=`<label class="share-user-item flex items-center gap-3 p-3 bg-slate-50 border rounded-xl"><input type="checkbox" name="share-user" value="${u.username}" ${(e.accessList||[]).includes(u.username)?'checked':''}><div><p class="text-sm font-bold share-name">${u.name}</p><p class="text-xs text-slate-500 share-username">@${u.username}</p></div></label>`;});window.openModalAnimated('modal-share');};
window.renderShareUsers=function(){const q=(document.getElementById('search-share-users')?.value||'').toLowerCase();document.querySelectorAll('.share-user-item').forEach(x=>x.style.display=(x.innerText||'').toLowerCase().includes(q)?'flex':'none');};
window.handleShareSubmit=function(e){e.preventDefault();const id=document.getElementById('share-event-id').value,ev=LS.getEvents(),i=ev.findIndex(x=>x.id===id);if(i>=0){ev[i].accessList=[...document.querySelectorAll('input[name="share-user"]:checked')].map(x=>x.value);LS.setEvents(ev);window.showToast('Akses event berhasil diperbarui!','success');}window.closeModalAnimated('modal-share');renderEvents();};

window.enterApp=function(id,callback){window.setLoadingText('txt_opening_event');switchMainViewAnimated('view-loading');setTimeout(()=>{const evt=LS.getEvents().find(e=>e.id===id);if(!evt)return;window.appState.currentEventId=id;document.getElementById('app-event-title').innerText=evt.name;const hc=document.getElementById('header-event-logo-container'),hi=document.getElementById('header-event-logo'),icon=document.getElementById('header-event-icon');if(evt.logo){hi.src=evt.logo;hc.classList.remove('hidden');hc.classList.add('flex');icon.classList.add('hidden');}else{hc.classList.add('hidden');hc.classList.remove('flex');icon.classList.remove('hidden');}const rs=!evt.type||evt.type==='Rumah Sakit',idLabel=rs?'Asal Rumah Sakit':'Asal Instansi';dict.id.lbl_rs=idLabel;dict.en.lbl_rs=rs?'Hospital Origin':'Institution Origin';document.getElementById('lbl-input-rs').innerHTML=`<span data-i18n="lbl_rs">${idLabel}</span> <span class="text-red-600 font-bold">*</span>`;document.getElementById('lbl-edit-rs').innerHTML=document.getElementById('lbl-input-rs').innerHTML;document.getElementById('th-list-rs').innerText=idLabel;document.getElementById('th-att-rs').innerText=idLabel;document.getElementById('info-lbl-rs').innerText=idLabel;const hidden=evt.hiddenColumns||[], seat=evt.needsSeat!==false,hotel=!!evt.needsHotel;['container-input-kursi','container-edit-kursi'].forEach(x=>document.getElementById(x)?.classList.toggle('hidden',!seat));['th-list-kursi','th-att-kursi'].forEach(x=>{const e=document.getElementById(x);if(e)e.style.display=seat&&!hidden.includes('kursi')?'table-cell':'none';});['container-input-kamar','container-edit-kamar'].forEach(x=>document.getElementById(x)?.classList.toggle('hidden',!hotel));['th-list-kamar','th-att-kamar'].forEach(x=>{const e=document.getElementById(x);if(e)e.style.display=hotel&&!hidden.includes('kamar')?'table-cell':'none';});const key=document.getElementById('th-list-kunci');if(key)key.style.display=hotel&&!hidden.includes('kunci')?'table-cell':'none';const ak=document.getElementById('th-att-kamar');if(ak)ak.style.display=hotel&&!hidden.includes('kamar')?'table-cell':'none';window.applyHiddenColumnsToTableHeaders(evt);window.applyLanguage();window.renderCustomNumberFieldsForm(evt,'container-custom-number-fields','custom-gen',{},null);window.guests=LS.getGuests(id);window.currentPageGuests=1;window.currentPageAttended=1;window.selectedGuestIds=new Set();switchMainViewAnimated('view-app');window.applyFeaturePermissions?.();window.switchTab(window.getDefaultTabName?window.getDefaultTabName():'dashboard');if(callback)callback();},800);};
window.exitAppToLibrary=function(){window.stopScanner?.();window.appState.currentEventId=null;window.guests=[];dict.id.lbl_rs='Asal Rumah Sakit';dict.en.lbl_rs='Hospital Origin';loadLibrary();};

// Toggle show/hide of "seat label type" option based on needsSeat checkbox
window.toggleSeatLabelOption = function () {
  const needsSeat = document.getElementById("event-needs-seat").checked;
  document.getElementById("event-seat-label-container")?.classList.toggle("hidden", !needsSeat);
  const hideColRow = document.getElementById("event-hide-col-kursi-row");
  if (hideColRow) hideColRow.classList.toggle("hidden", !needsSeat);
  if (!needsSeat) { const cb = document.getElementById("event-hide-col-kursi"); if (cb) cb.checked = false; }
};

// Toggle show/hide of "key signature required" option based on needsHotel checkbox
window.toggleHotelKeySignatureOption = function () {
  const needsHotel = document.getElementById("event-needs-hotel").checked;
  document.getElementById("event-key-signature-container")?.classList.toggle("hidden", !needsHotel);
  ["event-hide-col-kamar-row", "event-hide-col-kunci-row"].forEach((rowId) => {
    const row = document.getElementById(rowId);
    if (row) row.classList.toggle("hidden", !needsHotel);
  });
  if (!needsHotel) {
    ["event-hide-col-kamar", "event-hide-col-kunci"].forEach((cbId) => {
      const cb = document.getElementById(cbId); if (cb) cb.checked = false;
    });
  }
};

// Show the event logo filename/preview info row in the event form
window.showEventLogoFileInfo = function (label, previewSrc) {
  const wrap = document.getElementById("event-logo-filename-wrap");
  const text = document.getElementById("event-logo-filename-text");
  const preview = document.getElementById("event-logo-filename-preview");
  if (!wrap || !text) return;
  text.innerText = label;
  if (preview) { if (previewSrc) { preview.src = previewSrc; preview.classList.remove("hidden"); } else { preview.classList.add("hidden"); } }
  wrap.classList.remove("hidden");
};

// Hide the event logo filename/preview info row
window.hideEventLogoFileInfo = function () {
  const wrap = document.getElementById("event-logo-filename-wrap");
  if (wrap) wrap.classList.add("hidden");
};
