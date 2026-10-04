// EventQ - Kiosk mode (attendance, pickup, data check)
// Extracted from newVersion/app.js. This classic script intentionally shares
// the global state declared by js/state.js and helpers from other modules.

let kioskAudioCtx = null;
let kioskSigCanvas = null, kioskSigCtx = null, isKioskSigCanvasEmpty = true;
let pendingKioskPickupGuest = null, pendingKioskPickupEvt = null;
let kioskPinFailCount = 0;
let kioskPinLockUntil = 0;
window.currentKioskType = 'attendance';
window.pendingKioskType = 'attendance';
let kioskTypeChoiceContext = 'launch';

// ===== Mode Kiosk: Layar Penuh Khusus Scan Kehadiran (Self-Service) =====
// Menyembunyikan seluruh navigasi/tab aplikasi dan hanya fokus pada scan QR absensi.
// Instance scanner dibuat terpisah (kioskScannerInstance) dari scanner tab biasa supaya
// kamera tidak direbut dua proses sekaligus saat berpindah mode.

// ----- Feedback Audio: Beep + Ucapan Nama Peserta -----
// Beep disintesis langsung lewat Web Audio API (tanpa file audio eksternal) supaya ringan,
// instan, dan selalu tersedia offline. Ucapan nama peserta & salam selamat datang memakai
// Web Speech API (speechSynthesis) bawaan browser — tanpa perlu layanan TTS eksternal.
window.isKioskAudioEnabled = function() {
    const v = LS.getSetting('kiosk_audio_enabled');
    return (v === null || v === undefined || v === '') ? true : v !== 'false'; // default: nyala
};

window.toggleKioskAudio = function() {
    const wasEnabled = window.isKioskAudioEnabled();
    LS.setSetting('kiosk_audio_enabled', wasEnabled ? 'false' : 'true');
    window.updateKioskAudioButtonUI();
    if (wasEnabled) { try { window.speechSynthesis.cancel(); } catch(e) {} }
    else window.playKioskBeep('success'); // bip konfirmasi singkat saat suara baru dinyalakan
};

window.updateKioskAudioButtonUI = function() {
    const btn = document.getElementById('btn-kiosk-audio-toggle');
    const icon = document.getElementById('kiosk-audio-icon');
    if (!btn || !icon) return;
    const enabled = window.isKioskAudioEnabled();
    icon.className = enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    btn.title = enabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi';
    btn.classList.toggle('text-indigo-600', enabled); btn.classList.toggle('dark:text-indigo-400', enabled);
    btn.classList.toggle('text-slate-400', !enabled); btn.classList.toggle('dark:text-slate-500', !enabled);
};

// ----- Toggle khusus suara Text-to-Speech (terpisah dari beep) -----
// Independen dari window.isKioskAudioEnabled() (yang mengendalikan bip) - supaya operator
// kiosk bisa memilih kombinasi sesuai kebutuhan, mis. bip tetap menyala tapi ucapan nama
// peserta dimatikan. Ucapan tetap butuh KEDUA saklar ini menyala (lihat window.speakKioskMessage),
// jadi mematikan saklar suara utama tetap membisukan semuanya termasuk ucapan.
window.isKioskTTSEnabled = function() {
    const v = LS.getSetting('kiosk_tts_enabled');
    return (v === null || v === undefined || v === '') ? true : v !== 'false'; // default: nyala
};

window.toggleKioskTTS = function() {
    const wasEnabled = window.isKioskTTSEnabled();
    LS.setSetting('kiosk_tts_enabled', wasEnabled ? 'false' : 'true');
    window.updateKioskTTSButtonUI();
    if (wasEnabled) { try { window.speechSynthesis.cancel(); } catch(e) {} }
    else window.speakKioskMessage(window.getKioskTTSLang() === 'id' ? 'Suara aktif' : 'Voice on'); // konfirmasi singkat kalau suara ucapan baru dinyalakan
};

window.updateKioskTTSButtonUI = function() {
    const btn = document.getElementById('btn-kiosk-tts-toggle');
    const icon = document.getElementById('kiosk-tts-icon');
    if (!btn || !icon) return;
    const enabled = window.isKioskTTSEnabled();
    icon.className = enabled ? 'fa-solid fa-comment-dots' : 'fa-solid fa-comment-slash';
    btn.title = enabled ? 'Matikan suara ucapan (Text-to-Speech)' : 'Nyalakan suara ucapan (Text-to-Speech)';
    btn.classList.toggle('text-indigo-600', enabled); btn.classList.toggle('dark:text-indigo-400', enabled);
    btn.classList.toggle('text-slate-400', !enabled); btn.classList.toggle('dark:text-slate-500', !enabled);
};

function getKioskAudioCtx() {
    if (!kioskAudioCtx) {
        const AudioContextCls = window.AudioContext || window.webkitAudioContext;
        if (AudioContextCls) { try { kioskAudioCtx = new AudioContextCls(); } catch(e) { kioskAudioCtx = null; } }
    }
    if (kioskAudioCtx && kioskAudioCtx.state === 'suspended') kioskAudioCtx.resume().catch(() => {});
    return kioskAudioCtx;
}

// Nada beep disintesis per status: 'success' (dua nada naik, ceria & singkat),
// 'warning' (dua bip datar — sudah pernah absen), 'error' (nada turun — QR tak dikenali).
window.playKioskBeep = function(type) {
    if (!window.isKioskAudioEnabled()) return;
    const ctx = getKioskAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (freq, start, dur, vol) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol || 0.22, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + start); osc.stop(now + start + dur + 0.03);
    };
    if (type === 'success') { tone(880, 0, 0.12); tone(1318.5, 0.11, 0.18); }
    else if (type === 'warning') { tone(660, 0, 0.11); tone(660, 0.16, 0.11); }
    else { tone(392, 0, 0.1); tone(261.6, 0.11, 0.22); }
};

// Memilih suara wanita Bahasa Inggris yang paling natural di antara suara yang tersedia
// di browser/OS. Web Speech API tidak punya properti gender resmi, jadi dicocokkan lewat
// nama-nama suara wanita yang umum ditemukan lintas platform (Chrome/Google, Windows, macOS),
// sekaligus secara aktif menghindari suara yang jelas bernama pria.
function pickFemaleEnglishVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    if (enVoices.length === 0) return null;

    const femaleHints = ['female', 'zira', 'aria', 'jenny', 'michelle', 'samantha', 'victoria', 'karen',
        'moira', 'tessa', 'fiona', 'allison', 'ava', 'susan', 'kate', 'salli', 'joanna', 'kimberly',
        'ivy', 'olivia', 'emma', 'amy', 'nicole', 'raveena', 'google us english'];
    const maleHints = ['male', 'david', 'mark', 'guy', 'alex', 'daniel', 'fred', 'tom', 'james', 'ryan'];

    const nameHasAny = (name, hints) => hints.some(h => name.includes(h));

    // 1) Suara EN yang namanya cocok dengan daftar suara wanita yang dikenal (prioritas utama,
    //    "Google US English" biasanya paling natural/tidak robotik bila tersedia).
    let pick = enVoices.find(v => nameHasAny(v.name.toLowerCase(), femaleHints));
    if (pick) return pick;

    // 2) Kalau tidak ada nama yang cocok persis, ambil suara EN mana pun yang BUKAN teridentifikasi pria.
    pick = enVoices.find(v => !nameHasAny(v.name.toLowerCase(), maleHints));
    if (pick) return pick;

    // 3) Fallback terakhir: suara EN pertama yang tersedia, apa pun namanya.
    return enVoices[0];
}

// Memilih suara Bahasa Indonesia yang tersedia di perangkat/browser, dengan preferensi
// suara wanita kalau namanya cocok dengan pola umum suara ID (mis. "Damayanti", "Gadis").
// Ketersediaan suara ID jauh lebih terbatas dibanding EN tergantung OS/browser pengguna -
// kalau tidak ada satu pun suara berbahasa Indonesia terpasang, browser akan otomatis
// memakai suara default-nya sendiri untuk lang 'id-ID' (fallback bawaan browser, bukan gagal).
function pickIndonesianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const idVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('id'));
    if (idVoices.length === 0) return null;

    const femaleHints = ['female', 'wanita', 'perempuan', 'damayanti', 'gadis', 'google bahasa indonesia'];
    const pick = idVoices.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h)));
    return pick || idVoices[0];
}

// Bahasa suara Text-to-Speech Mode Kiosk - diatur lewat Pengaturan > Mode Kiosk
// (lihat window.setKioskTTSLang). Default 'en' supaya perilaku lama tidak berubah
// bagi yang belum pernah mengatur pilihan ini.
window.getKioskTTSLang = function() {
    const v = LS.getSetting('kiosk_tts_lang');
    return v === 'id' ? 'id' : 'en';
};

window.speakKioskMessage = function(text) {
    if (!window.isKioskAudioEnabled() || !window.isKioskTTSEnabled() || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel(); // hentikan ucapan sebelumnya yang mungkin masih berjalan
        const utter = new SpeechSynthesisUtterance(text);
        // Rate mendekati normal (bukan lambat) & pitch sedikit lebih tinggi supaya alur ucapan
        // terdengar lebih lancar, hangat, dan natural — cocok untuk suara wanita.
        utter.rate = 1.02; utter.pitch = 1.05; utter.volume = 1;
        if (window.getKioskTTSLang() === 'id') {
            utter.lang = 'id-ID';
            const voice = pickIndonesianVoice(); if (voice) utter.voice = voice;
        } else {
            utter.lang = 'en-US';
            const voice = pickFemaleEnglishVoice(); if (voice) utter.voice = voice;
        }
        window.speechSynthesis.speak(utter);
    } catch(e) { console.warn('Speech synthesis error:', e); }
};

// Menggabungkan beep + ucapan nama peserta & nama event sesuai status hasil scan.
// Bahasa ucapan mengikuti pilihan admin di Pengaturan > Mode Kiosk (lihat
// window.getKioskTTSLang) - default Bahasa Inggris seperti sebelumnya.
// 'success' -> menyapa nama peserta & menyebut nama event.
// 'already' -> beri tahu bahwa peserta ini sudah tercatat hadir sebelumnya.
// 'notfound' -> hanya bip gagal, tanpa ucapan (tidak ada nama peserta untuk disebut).
window.playKioskFeedback = function(status, guest, evt) {
    if (!window.isKioskAudioEnabled()) return;
    const eventName = evt ? evt.name : '';
    const lang = window.getKioskTTSLang();
    if (status === 'success') {
        window.playKioskBeep('success');
        if (guest) {
            const msg = lang === 'id'
                ? `Selamat datang, ${guest.nama}, di Event ${eventName}.`
                : `Welcome, ${guest.nama}, to Event ${eventName}.`;
            window.speakKioskMessage(msg);
        }
    } else if (status === 'already') {
        window.playKioskBeep('warning');
        if (guest) {
            const msg = lang === 'id'
                ? `${guest.nama}, Anda sudah tercatat hadir sebelumnya.`
                : `${guest.nama}, you have already been recorded as present.`;
            window.speakKioskMessage(msg);
        }
    } else if (status === 'pickup_found') {
        // Kiosk Pengambilan: cukup bip sukses sebagai konfirmasi data ketemu — tanpa ucapan
        // suara, karena modal hasil sudah menampilkan nama & Nomor Khusus/Unik secara visual.
        window.playKioskBeep('success');
    } else if (status === 'pickup_already') {
        // Kiosk Pengambilan: nomor ini SUDAH PERNAH discan sebelumnya - bip peringatan + ucapan
        // suara (kalau aktif) supaya panitia di konter langsung sadar tanpa harus menatap layar
        // terus, karena posisi ini biasanya dipakai sambil menyerahkan barang/kunci ke peserta.
        window.playKioskBeep('warning');
        if (guest) {
            const msg = lang === 'id'
                ? `Perhatian, ${guest.nama} sudah pernah mengambil nomornya sebelumnya.`
                : `Attention, ${guest.nama} has already picked up their number before.`;
            window.speakKioskMessage(msg);
        }
    } else if (status === 'check_found') {
        // Kiosk Cek Data: sama seperti pickup_found, cukup bip sukses tanpa ucapan suara —
        // datanya sudah ditampilkan secara visual di layar hasil.
        window.playKioskBeep('success');
    } else {
        window.playKioskBeep('error');
    }
};

// Membuka modal pemilihan JENIS Mode Kiosk (Absensi/Pengambilan) — langkah pertama sebelum
// modal pemilihan lokasi tampil (window.openKioskLaunchChoiceModal), dipanggil dari tombol
// "Mode Kiosk" di header event.
window.openKioskTypeChoiceModal = function() {
    if (!window.hasFeaturePerm('kioskMode')) return window.showToast('Anda tidak memiliki akses ke fitur Mode Kiosk', 'error');
    if (!window.appState.currentEventId) return;
    kioskTypeChoiceContext = 'launch';
    updateKioskTypeChoiceBadges();
    window.openModalAnimated('modal-kiosk-type-choice');
};

// Menampilkan/menyembunyikan label "Aktif" di modal pemilihan jenis kiosk (modal-kiosk-type-choice).
// Hanya relevan saat modal dibuka dari tombol ganti jenis DI DALAM Mode Kiosk yang sedang berjalan
// (kioskTypeChoiceContext === 'switch') supaya operator tahu jenis mana yang sedang aktif; disembunyikan
// semua saat modal dibuka dari tombol "Mode Kiosk" di header event (belum ada kiosk yang berjalan).
function updateKioskTypeChoiceBadges() {
    ['attendance', 'pickup', 'check'].forEach(t => {
        const badge = document.getElementById(`kiosk-type-active-badge-${t}`);
        if (!badge) return;
        const shouldShow = kioskTypeChoiceContext === 'switch' && window.currentKioskType === t;
        badge.classList.toggle('hidden', !shouldShow);
    });
}

// Menyimpan jenis kiosk yang dipilih. Perilaku bercabang tergantung konteks modal dibuka:
// - context 'launch' (dari tombol "Mode Kiosk" di header event, belum ada kiosk berjalan):
//   simpan sebagai pendingKioskType, lalu lanjut ke modal pemilihan lokasi tampil seperti biasa.
// - context 'switch' (dari tombol ganti jenis di dalam Mode Kiosk yang SEDANG berjalan): langsung
//   minta konfirmasi lalu berpindah jenis di tempat, tanpa keluar dari Mode Kiosk sama sekali
//   (lihat window.confirmSwitchKioskTypeTo & window.switchKioskType).
window.chooseKioskType = function(type) {
    const normalizedType = (type === 'pickup') ? 'pickup' : (type === 'check') ? 'check' : 'attendance';
    window.closeModalAnimated('modal-kiosk-type-choice');

    if (kioskTypeChoiceContext === 'switch') {
        if (normalizedType === window.currentKioskType) return; // sudah aktif, tidak perlu apa-apa
        window.confirmSwitchKioskTypeTo(normalizedType);
        return;
    }

    window.pendingKioskType = normalizedType;
    window.openKioskLaunchChoiceModal();
};

// Tombol panah kembali di modal "Buka Mode Kiosk" — menutup modal ini dan membuka lagi
// modal pemilihan jenis kiosk, tanpa perlu membatalkan seluruh alur dari awal.
window.backToKioskTypeChoice = function() {
    window.closeModalAnimated('modal-kiosk-launch-choice');
    window.openKioskTypeChoiceModal();
};

// Membuka modal pilihan lokasi tampil Mode Kiosk (jendela baru/tab baru/jendela ini),
// dipanggil dari tombol "Mode Kiosk" di header event — menggantikan window.enterKioskMode
// yang sebelumnya dipanggil langsung.
window.openKioskLaunchChoiceModal = function() {
    if (!window.hasFeaturePerm('kioskMode')) return window.showToast('Anda tidak memiliki akses ke fitur Mode Kiosk', 'error');
    if (!window.appState.currentEventId) return;
    window.openModalAnimated('modal-kiosk-launch-choice');
};

// Eksekusi pilihan dari modal: 'window' & 'tab' membuka ulang aplikasi ini via window.open()
// dengan parameter ?kiosk=<eventId>&kioskType=<jenis> di URL, 'same' langsung memasuki
// Mode Kiosk di layar ini dengan jenis yang sudah dipilih sebelumnya.
// Sesi login (sessionStorage) otomatis tersalin browser ke tab/jendela baru selama window.open()
// dipanggil tanpa 'noopener' dan masih origin yang sama — lihat window.tryLaunchPendingKiosk
// yang membaca parameter tsb begitu tab/jendela baru selesai memuat & sesi siap dipakai.
window.launchKioskInNewContext = function(mode) {
    window.closeModalAnimated('modal-kiosk-launch-choice');
    if (mode === 'same') { window.enterKioskMode(window.pendingKioskType); return; }

    const url = new URL(window.location.href);
    url.searchParams.set('kiosk', window.appState.currentEventId);
    url.searchParams.set('kioskType', window.pendingKioskType);
    url.hash = '';

    if (mode === 'window') window.open(url.toString(), '_blank', 'width=1280,height=800');
    else window.open(url.toString(), '_blank');
};

// Dipanggil setiap kali sesi login siap dipakai (boot ulang dengan sesi tersimpan, maupun
// setelah login manual) untuk memeriksa apakah tab/jendela ini dibuka khusus untuk langsung
// masuk Mode Kiosk pada event tertentu (lewat parameter ?kiosk=<eventId>&kioskType=<jenis> di URL).
window.tryLaunchPendingKiosk = function() {
    if (!pendingKioskLaunchEventId || !window.appState.currentUser) return;
    const id = pendingKioskLaunchEventId;
    const type = pendingKioskLaunchType;
    pendingKioskLaunchEventId = null; // konsumsi sekali agar tidak retrigger

    // Bersihkan parameter dari address bar supaya rapi & tidak ikut ter-refresh/ter-share ulang
    try { const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('kiosk'); cleanUrl.searchParams.delete('kioskType'); window.history.replaceState({}, '', cleanUrl); } catch(e) {}

    const evt = LS.getEvents().find(e => e.id === id);
    const user = window.appState.currentUser;
    const hasAccess = evt && (user.role === 'admin' || (evt.accessList && evt.accessList.includes(user.username)));
    if (evt && hasAccess && window.hasFeaturePerm('kioskMode')) {
        window.enterApp(id, () => window.enterKioskMode(type));
    }
    // Jika event tidak ditemukan/tidak ada akses, biarkan saja lanjut ke Library seperti biasa.
};

window.enterKioskMode = function(type) {
    if (!window.hasFeaturePerm('kioskMode')) return window.showToast('Anda tidak memiliki akses ke fitur Mode Kiosk', 'error');
    if (!window.appState.currentEventId) return;

    window.currentKioskType = (type === 'pickup') ? 'pickup' : (type === 'check') ? 'check' : 'attendance';
    window.stopGuestAutoRefresh?.(); // Kiosk menutupi daftar peserta, hentikan polling.
    window.stopScanner(); // hentikan scanner tab biasa agar kamera tidak bentrok

    // Prime AudioContext & daftar suara TTS memakai gestur klik ini (tombol Mode Kiosk),
    // supaya pemutaran beep/ucapan berikutnya — yang dipicu otomatis oleh hasil scan kamera,
    // bukan klik langsung — tidak diblokir kebijakan autoplay browser.
    getKioskAudioCtx();
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    window.updateKioskAudioButtonUI();
    window.updateKioskTTSButtonUI();
    window.updateKioskSwitchTypeButtonUI();

    const evt = LS.getEvents().find(e => e.id === window.appState.currentEventId);
    document.getElementById('kiosk-event-title').innerText = evt ? evt.name : 'Event';

    const logoContainer = document.getElementById('kiosk-event-logo-container');
    const logoImg = document.getElementById('kiosk-event-logo');
    const iconEl = document.getElementById('kiosk-event-icon');
    if (evt && evt.logo) { logoImg.src = evt.logo; logoContainer.classList.remove('hidden'); logoContainer.classList.add('flex'); iconEl.classList.add('hidden'); }
    else { logoContainer.classList.add('hidden'); logoContainer.classList.remove('flex'); iconEl.classList.remove('hidden'); }

    // Teks & statistik scan-view menyesuaikan jenis kiosk — statistik kehadiran (Total/Hadir/Belum)
    // hanya relevan untuk Kiosk Absensi, jadi disembunyikan pada Kiosk Pengambilan. Logika ini
    // dipakai bersama window.switchKioskType lewat helper applyKioskTypeViewTexts di bawah, supaya
    // tombol shortcut ganti jenis kiosk konsisten dengan tampilan awal saat kiosk pertama dibuka.
    const scanTitle = document.getElementById('kiosk-scan-title');
    if (scanTitle) scanTitle.innerText = 'Scan QR Code Anda';
    applyKioskTypeViewTexts(window.currentKioskType);

    document.getElementById('kiosk-result-view').classList.add('hidden');
    document.getElementById('kiosk-result-view').classList.remove('flex');
    document.getElementById('kiosk-scan-view').classList.remove('hidden');
    isKioskScanLocked = false;

    window.renderKioskStats();

    const view = document.getElementById('kiosk-mode-view');
    view.classList.remove('hidden'); view.classList.add('flex');

    // Best-effort fullscreen (butuh gesture pengguna; aman kalau ditolak/tidak didukung browser)
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }

    setTimeout(() => {
        if (kioskScannerInstance === null) {
            kioskScannerInstance = new Html5QrcodeScanner("reader-kiosk", { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true }, false);
            kioskScannerInstance.render(window.onKioskScanSuccess, () => {});
        }
    }, 300);
};

// Menerapkan teks sub-judul & visibilitas bar statistik pada layar scan kiosk sesuai jenisnya
// (Absensi/Pengambilan/Cek Data). Dipakai bersama oleh window.enterKioskMode (saat kiosk pertama kali
// dibuka) & window.switchKioskType (saat berpindah jenis lewat tombol shortcut di header) supaya
// tidak ada duplikasi logika dan keduanya selalu tampil konsisten.
function applyKioskTypeViewTexts(type) {
    const scanSub = document.getElementById('kiosk-scan-sub');
    const statsBar = document.getElementById('kiosk-stats-bar');
    if (type === 'pickup') {
        if (scanSub) scanSub.innerText = 'Arahkan QR Code peserta ke kamera untuk melihat nomor voucher Anda';
        if (statsBar) statsBar.classList.add('hidden');
    } else if (type === 'check') {
        if (scanSub) scanSub.innerText = 'Arahkan QR Code Anda ke kamera untuk melihat data diri';
        if (statsBar) statsBar.classList.add('hidden');
    } else {
        if (scanSub) scanSub.innerText = 'Arahkan QR Code kehadiran ke kamera untuk absen';
        if (statsBar) statsBar.classList.remove('hidden');
    }
}

// ===== Tombol Shortcut: Berpindah Jenis Mode Kiosk (Absensi/Pengambilan/Cek Data) =====
// Sebelumnya, berpindah jenis kiosk saat sedang berjalan mengharuskan operator keluar dulu
// (butuh PIN keluar) lalu membuka ulang dari tombol "Mode Kiosk" di dashboard - merepotkan kalau
// satu perangkat dipakai bergantian untuk beberapa jenis kiosk dalam event yang sama.
// Tombol ini ada di header layar Mode Kiosk (lihat #btn-kiosk-switch-type di index.html) dan
// memindahkan jenis kiosk secara langsung TANPA perlu PIN keluar/masuk ulang, karena tetap berada
// di dalam Mode Kiosk (tidak membuka akses ke halaman manajemen data). Sebelumnya tombol ini hanya
// toggle dua arah (Absensi <-> Pengambilan); sekarang dengan 3 jenis kiosk tombol ini membuka modal
// pemilihan jenis yang sama dengan alur "Mode Kiosk" awal (lihat window.openKioskSwitchTypeModal),
// supaya operator bisa langsung memilih salah satu dari ketiganya.
window.updateKioskSwitchTypeButtonUI = function() {
    const btn = document.getElementById('btn-kiosk-switch-type');
    const icon = document.getElementById('kiosk-switch-type-icon');
    if (!btn || !icon) return;
    icon.className = 'fa-solid fa-arrows-rotate';
    btn.title = window.currentLang === 'id' ? 'Ganti Jenis Mode Kiosk' : 'Switch Kiosk Type';
};

// Membuka kembali modal pemilihan jenis kiosk (modal-kiosk-type-choice) dari DALAM Mode Kiosk
// yang sedang berjalan, dengan konteks 'switch' supaya window.chooseKioskType tahu harus langsung
// berpindah jenis (dengan konfirmasi) alih-alih lanjut ke modal pemilihan lokasi tampil. Jenis yang
// sedang aktif ditandai dengan label "Aktif" (lihat updateKioskTypeChoiceBadges).
window.openKioskSwitchTypeModal = function() {
    kioskTypeChoiceContext = 'switch';
    updateKioskTypeChoiceBadges();
    window.openModalAnimated('modal-kiosk-type-choice');
};

// Meminta konfirmasi dulu sebelum berpindah jenis - supaya operator tidak tidak sengaja mengganti
// jenis kiosk di tengah antrean peserta yang sedang memindai QR (memakai modal konfirmasi generik
// window.openConfirmCustom yang sudah dipakai fitur lain, dan tetap tampil di atas layar kiosk).
window.confirmSwitchKioskTypeTo = function(targetType) {
    const targetLabel = targetType === 'pickup' ? 'Kiosk QR Code Pengambilan' : (targetType === 'check' ? 'Kiosk Cek Data' : 'Kiosk Absensi');
    window.openConfirmCustom(
        'Ganti Jenis Mode Kiosk?',
        `Layar scan akan berpindah ke ${targetLabel}. Pastikan tidak ada peserta yang sedang memindai QR.`,
        () => window.switchKioskType(targetType)
    );
};

// Memutar animasi transisi saat jenis kiosk berpindah: layar scan (judul/sub-judul/bar statistik
// yang baru saja diperbarui teksnya oleh applyKioskTypeViewTexts) meluncur & memudar masuk, dan
// ikon tombol shortcut berputar sekali sebagai umpan balik bahwa klik berhasil memicu perpindahan.
// Class dilepas dulu & dipaksa reflow (void offsetWidth) sebelum dipasang lagi supaya animasi bisa
// diputar ulang walau tombol dipakai berkali-kali berturut-turut - pola yang sama dipakai
// window.pulseStatElement untuk animasi angka statistik yang berubah.
window.playKioskTypeSwitchAnimation = function() {
    const scanView = document.getElementById('kiosk-scan-view');
    if (scanView) {
        scanView.classList.remove('kiosk-type-switch-in'); void scanView.offsetWidth; scanView.classList.add('kiosk-type-switch-in');
        setTimeout(() => scanView.classList.remove('kiosk-type-switch-in'), 450);
    }
    const icon = document.getElementById('kiosk-switch-type-icon');
    if (icon) {
        icon.classList.remove('kiosk-switch-btn-spin'); void icon.offsetWidth; icon.classList.add('kiosk-switch-btn-spin');
        setTimeout(() => icon.classList.remove('kiosk-switch-btn-spin'), 550);
    }
};

// Eksekusi perpindahan jenis kiosk yang sudah dikonfirmasi. Instance scanner & AudioContext yang
// sama tetap dipakai (kamera tidak perlu di-restart) - hanya teks/tampilan layar scan serta
// interpretasi hasil scan berikutnya yang berubah (lihat window.onKioskScanSuccess).
window.switchKioskType = function(type) {
    const newType = (type === 'pickup') ? 'pickup' : (type === 'check') ? 'check' : 'attendance';
    if (newType === window.currentKioskType) return;

    window.currentKioskType = newType;
    window.pendingKioskType = newType; // ikut disinkronkan agar konsisten jika modal pemilihan jenis dibuka lagi nanti

    applyKioskTypeViewTexts(newType);
    window.resetKioskToScan(); // kembali ke layar scan (menutup hasil scan sebelumnya jika masih tampil) & buka kunci scanner
    window.updateKioskSwitchTypeButtonUI(); // set ikon dasar dulu sebelum animasi putar ditambahkan di atasnya
    window.playKioskTypeSwitchAnimation();

    const label = newType === 'pickup' ? 'Kiosk QR Code Pengambilan' : (newType === 'check' ? 'Kiosk Cek Data' : 'Kiosk Absensi');
    window.showToast(`Berpindah ke ${label}`, 'success');
};

// Membuka modal PIN sebagai gerbang keluar dari Mode Kiosk — mencegah peserta (yang hanya
// berinteraksi dengan scanner self-service) tanpa sengaja atau sengaja masuk ke halaman
// manajemen data event hanya dengan menekan tombol keluar.
window.confirmExitKioskMode = function() {
    const input = document.getElementById('kiosk-exit-pin-input');
    const errorEl = document.getElementById('kiosk-exit-pin-error');
    if (input) input.value = '';
    if (errorEl) {
        if (Date.now() < kioskPinLockUntil) {
            const secsLeft = Math.ceil((kioskPinLockUntil - Date.now()) / 1000);
            errorEl.innerHTML = `<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam ${secsLeft} detik.`;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    }
    window.openModalAnimated('modal-kiosk-exit-pin');
    setTimeout(() => { if (input) input.focus(); }, 150);
};

// Validasi PIN: memakai PIN khusus (kiosk_exit_pin) bila sudah diatur di Pengaturan Aplikasi;
// jika belum pernah diatur, memakai password akun Admin yang sedang login sebagai gantinya —
// jadi fitur ini langsung aktif tanpa perlu setup tambahan, dan admin bisa mempersingkatnya
// dengan PIN sederhana kapan pun lewat menu Pengaturan.
// Setelah 5 kali salah berturut-turut, input dikunci sementara (30 detik) untuk mencegah
// percobaan menebak PIN secara bertubi-tubi.
window.executeKioskExitPin = function(e) {
    e.preventDefault();
    const input = document.getElementById('kiosk-exit-pin-input');
    const errorEl = document.getElementById('kiosk-exit-pin-error');

    if (Date.now() < kioskPinLockUntil) {
        const secsLeft = Math.ceil((kioskPinLockUntil - Date.now()) / 1000);
        if (errorEl) { errorEl.innerHTML = `<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam ${secsLeft} detik.`; errorEl.classList.remove('hidden'); }
        input.value = '';
        return;
    }

    const entered = input.value;
    const customPin = LS.getSetting('kiosk_exit_pin');
    let isValid = false;
    if (customPin) {
        isValid = entered === customPin;
    } else {
        const currentUser = LS.getUsers().find(u => u.username === window.appState.currentUser.username);
        isValid = !!currentUser && entered === currentUser.password;
    }

    if (isValid) {
        kioskPinFailCount = 0;
        window.closeModalAnimated('modal-kiosk-exit-pin');
        window.exitKioskMode();
    } else {
        kioskPinFailCount++;
        if (kioskPinFailCount >= 5) {
            kioskPinLockUntil = Date.now() + 30000;
            kioskPinFailCount = 0;
            if (errorEl) { errorEl.innerHTML = '<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam 30 detik.'; errorEl.classList.remove('hidden'); }
        } else if (errorEl) {
            errorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1"></i>PIN salah, silakan coba lagi.'; errorEl.classList.remove('hidden');
        }
        input.value = ''; input.focus();
    }
};

// ----- Pengaturan PIN Keluar Kiosk (halaman Pengaturan Aplikasi) -----
window.loadKioskPinSettingsUI = function() {
    const statusEl = document.getElementById('kiosk-pin-status');
    const inputEl = document.getElementById('kiosk-exit-pin');
    if (inputEl) inputEl.value = ''; // tidak menampilkan ulang PIN tersimpan demi keamanan
    if (!statusEl) return;
    const pin = LS.getSetting('kiosk_exit_pin');
    statusEl.innerHTML = pin
        ? '<i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i> PIN khusus sudah diatur & aktif.'
        : '<i class="fa-solid fa-circle-info text-amber-500 mr-1"></i> Belum diatur — memakai password akun Admin yang sedang login.';
};

window.saveKioskExitPin = function(e) {
    e.preventDefault();
    const val = document.getElementById('kiosk-exit-pin').value.trim();
    LS.setSetting('kiosk_exit_pin', val); // dikosongkan = hapus PIN khusus, kembali ke fallback password Admin
    window.loadKioskPinSettingsUI();
    window.showToast(val ? 'PIN keluar kiosk berhasil disimpan!' : 'PIN dihapus — kini memakai password Admin.', 'success');
};

window.exitKioskMode = function() {
    if (kioskResultTimer) { clearTimeout(kioskResultTimer); kioskResultTimer = null; }
    if (kioskScannerInstance) { kioskScannerInstance.clear().catch(e => console.warn(e)); kioskScannerInstance = null; }
    if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen().catch(() => {}); }
    try { window.speechSynthesis.cancel(); } catch(e) {} // hentikan ucapan yang mungkin masih berjalan

    const view = document.getElementById('kiosk-mode-view');
    view.classList.add('hidden'); view.classList.remove('flex');
    // Keluar dari Kiosk: kembalikan polling auto-refresh bila tab aktif
    // masih Data Peserta / Daftar Hadir.
    window.guestAutoRefreshSync?.();
};

window.renderKioskStats = function() {
    const total = window.guests.length;
    const hadir = window.guests.filter(g => g.scanned).length;
    const belum = total - hadir;
    const elTotal = document.getElementById('kiosk-stat-total'); if (elTotal) elTotal.innerText = total;
    const elHadir = document.getElementById('kiosk-stat-hadir'); if (elHadir) elHadir.innerText = hadir;
    const elBelum = document.getElementById('kiosk-stat-belum'); if (elBelum) elBelum.innerText = belum;
};

// Menandai peserta sebagai "sudah mengambil kunci" begitu berhasil scan di Kiosk QR Code
// Pengambilan - TIDAK menunggu proses tanda tangan selesai (jika tanda tangan kiosk sedang
// aktif & peserta memang menandatangani, fungsi ini dipanggil sekali lagi dari
// window.confirmKioskSignature untuk melengkapi buktinya dengan tanda tangan asli). Hanya
// berlaku untuk event yang membutuhkan kunci hotel & peserta memang punya kamar; di luar itu
// fungsi ini tidak melakukan apa pun (aman dipanggil kapan saja).
window.markKeyPickupFromKiosk = function(guest, evt, signatureDataUrl) {
    if (!guest || !evt || !evt.needsHotel || !guest.kamar || guest.kamar === '-') return;
    guest.kunciDiambil = true;
    guest.kunciDiambilOleh = guest.nama; // yang mengambil adalah peserta itu sendiri
    if (signatureDataUrl) guest.kunciSignature = signatureDataUrl;
    const linked = window.findLinkedGuests(guest);
    linked.forEach(lg => {
        lg.kunciDiambil = true;
        lg.kunciDiambilOleh = guest.nama;
        if (signatureDataUrl) lg.kunciSignature = signatureDataUrl;
    });
    saveGuests();
    window.renderTable();
};

window.onKioskScanSuccess = function(t) {
    if (isKioskScanLocked) return; isKioskScanLocked = true;
    try { if (kioskScannerInstance && kioskScannerInstance.getState && kioskScannerInstance.getState() === 2) kioskScannerInstance.pause(true); } catch(e) {}

    const g = window.guests.find(x => x.id === t);
    const evt = LS.getEvents().find(e => e.id === window.appState.currentEventId);

    if (window.currentKioskType === 'pickup') {
        // Kiosk Pengambilan: pencarian & tampilan data (checkbox "Kunci Diambil" ikut
        // tercentang otomatis begitu QR berhasil discan, lihat window.markKeyPickupFromKiosk
        // di atas) - TIDAK menandai/mengubah status kehadiran. Tanda tangan konfirmasi
        // bersifat OPSIONAL — diatur admin lewat toggle "Tanda Tangan Kiosk Pengambilan" di
        // Pengaturan Aplikasi (window.getKioskPickupSignatureEnabled()). Jika aktif, peserta
        // diminta tanda tangan dulu lewat modal kecil sebelum Nomor Khusus/Unik ditampilkan
        // (checkbox sudah tercentang duluan, tanda tangan hanya melengkapi buktinya); jika
        // dimatikan, data langsung ditampilkan begitu QR terpindai.
        if (g) {
            // guest.pickupScanned/pickupScanTime dilacak TERPISAH dari guest.kunciDiambil (yang
            // khusus kunci kamar hotel & hanya berlaku kalau evt.needsHotel) karena Kiosk
            // Pengambilan pada dasarnya untuk menampilkan Nomor Khusus/Unik apa pun — banyak
            // event yang memakainya sama sekali tidak butuh data hotel. Kalau QR yang sama
            // sudah pernah SELESAI discan sebelumnya (Nomor-nya sudah pernah tampil), JANGAN
            // diproses ulang - cukup tampilkan peringatan supaya panitia di konter sadar & bisa
            // mencegah pengambilan barang/kunci dua kali.
            // PERBAIKAN BUG: untuk event yang butuh kunci kamar (evt.needsHotel & peserta
            // punya kamar), status "sudah discan" ini HARUS diselaraskan dengan guest.kunciDiambil.
            // Kalau admin membatalkan bukti pengambilan kunci lewat checkbox "Kunci Diambil" di
            // tabel Data Peserta (window.toggleKey), kunciDiambil kembali jadi false, tapi
            // pickupScanned lama tidak ikut direset - akibatnya peserta yang mau mengambil kunci
            // ulang selalu diblokir peringatan "Sudah Pernah Diambil" padahal kunci belum/tidak
            // lagi tercatat diambil. Maka blokir hanya kalau kunci memang relevan (event butuh
            // hotel & peserta punya kamar) DAN kunciDiambil masih true; kalau tidak relevan
            // (event tanpa data hotel/Nomor Unik untuk keperluan lain), perilaku lama tetap
            // dipakai (murni berdasar pickupScanned) supaya use-case non-kunci tidak berubah.
            const keyStatusRelevant = !!(evt && evt.needsHotel && g.kamar && g.kamar !== '-');
            const alreadyPickedUp = g.pickupScanned && (!keyStatusRelevant || g.kunciDiambil);
            if (alreadyPickedUp) {
                window.showKioskResult('pickup_already', g, evt);
                return;
            }
            window.markKeyPickupFromKiosk(g, evt, null);
            if (window.getKioskPickupSignatureEnabled()) {
                // pickupScanned baru ditandai SETELAH tanda tangan dikonfirmasi (lihat
                // window.confirmKioskSignature), BUKAN di sini - supaya kalau peserta
                // membatalkan proses tanda tangan (window.cancelKioskSignature), QR yang sama
                // masih bisa dipindai ulang tanpa terjebak peringatan "Sudah Pernah Diambil"
                // yang keliru padahal Nomor-nya belum pernah benar-benar tampil.
                window.openKioskPickupSignature(g, evt);
            } else {
                g.pickupScanned = true;
                g.pickupScanTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                saveGuests();
                window.showKioskResult('pickup_found', g, evt);
            }
        }
        else { window.showKioskResult('notfound', null, evt); }
        return;
    }

    if (window.currentKioskType === 'check') {
        // Kiosk Cek Data: HANYA mencari & menampilkan data diri peserta apa adanya (nama, Quest ID,
        // asal, jabatan, kursi/meja - field yang sama dipakai oleh buildKioskDetailRows di bawah).
        // TIDAK mengubah status kehadiran (g.scanned) maupun status pengambilan kunci/tanda tangan
        // sama sekali - murni read-only, cocok dipakai panitia untuk memverifikasi data peserta
        // sewaktu-waktu tanpa risiko tidak sengaja mengubah data lain.
        if (g) window.showKioskResult('check_found', g, evt);
        else window.showKioskResult('notfound', null, evt);
        return;
    }

    if (g) {
        let status;
        if (!g.scanned) {
            g.scanned = true; g.scanTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            saveGuests(); status = 'success';
        } else { status = 'already'; }

        window.renderKioskStats?.();
        window.renderScanStats?.();
        window.renderTable?.();
        window.showKioskResult(status, g, evt);
    } else {
        window.showKioskResult('notfound', null, evt);
    }
};

function buildKioskDetailRows(guest, evt) {
    const rsLabel = dict[window.currentLang]['lbl_rs'] || 'Asal';
    let rows = `<div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2"><span class="text-slate-400 dark:text-slate-500">Quest ID</span><span class="font-bold text-slate-800 dark:text-slate-100">${guest.id}</span></div>
    <div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2"><span class="text-slate-400 dark:text-slate-500">${rsLabel}</span><span class="font-semibold text-slate-800 dark:text-slate-100 text-right">${guest.rs}</span></div>
    <div class="flex justify-between${(evt && evt.needsSeat !== false) ? ' border-b border-slate-200 dark:border-slate-700 pb-2' : ''}"><span class="text-slate-400 dark:text-slate-500">Jabatan</span><span class="font-semibold text-slate-800 dark:text-slate-100 text-right">${guest.jabatan}</span></div>`;
    if (evt && evt.needsSeat !== false) {
        const seatLabel = evt.seatLabelType === 'meja' ? 'No Meja' : 'No Kursi';
        rows += `<div class="flex justify-between"><span class="text-slate-400 dark:text-slate-500">${seatLabel}</span><span class="font-bold text-slate-800 dark:text-slate-100">${guest.kursi}</span></div>`;
    }
    return rows;
}

// Menampilkan panel hasil scan (sukses/sudah absen/tidak ditemukan) dengan progress bar
// hitung mundur, lalu otomatis kembali ke tampilan scanner setelah durasi yang diatur
// admin di Pengaturan Aplikasi (window.getKioskResetDurationSec()).
window.showKioskResult = function(status, guest, evt) {
    window.playKioskFeedback(status, guest, evt);

    const scanView = document.getElementById('kiosk-scan-view');
    const resultView = document.getElementById('kiosk-result-view');
    const iconWrap = document.getElementById('kiosk-result-icon-wrap');
    const icon = document.getElementById('kiosk-result-icon');
    const title = document.getElementById('kiosk-result-title');
    const name = document.getElementById('kiosk-result-name');
    const sub = document.getElementById('kiosk-result-sub');
    const details = document.getElementById('kiosk-result-details');

    scanView.classList.add('hidden');
    resultView.classList.remove('hidden'); resultView.classList.add('flex');
    resultView.classList.remove('kiosk-fade-in'); void resultView.offsetWidth; resultView.classList.add('kiosk-fade-in');

    if (status === 'success') {
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-emerald-100 dark:bg-emerald-500/20';
        icon.className = 'fa-solid fa-circle-check text-5xl text-emerald-600 dark:text-emerald-400 animate-success';
        title.innerText = 'Selamat Datang!'; title.className = 'text-3xl font-extrabold mb-2 text-emerald-600 dark:text-emerald-400';
        name.innerText = guest.nama;
        sub.innerText = 'Kehadiran Anda berhasil dicatat.';
        details.innerHTML = buildKioskDetailRows(guest, evt); details.classList.remove('hidden');
    } else if (status === 'already') {
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-amber-100 dark:bg-amber-500/20';
        icon.className = 'fa-solid fa-triangle-exclamation text-5xl text-amber-600 dark:text-amber-400';
        title.innerText = 'Sudah Absen'; title.className = 'text-3xl font-extrabold mb-2 text-amber-600 dark:text-amber-400';
        name.innerText = guest.nama;
        sub.innerText = `Anda sudah tercatat hadir pukul ${guest.scanTime || '-'}.`;
        details.innerHTML = buildKioskDetailRows(guest, evt); details.classList.remove('hidden');
    } else if (status === 'pickup_found') {
        // Kiosk Pengambilan: tampilkan identitas + Nomor Khusus/Unik peserta (dikonfigurasi
        // admin lewat "Nomor Khusus/Unik Peserta" di form Buat/Edit Event, mis. NIK atau
        // No. Registrasi) secara mencolok (besar), supaya mudah dibaca dari jarak agak jauh
        // saat peserta mengambil sesuatu di konter. Bisa lebih dari satu jenis nomor sekaligus.
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-indigo-100 dark:bg-indigo-500/20';
        icon.className = 'fa-solid fa-ticket text-5xl text-indigo-600 dark:text-indigo-400';
        title.innerText = 'Data Ditemukan'; title.className = 'text-3xl font-extrabold mb-2 text-indigo-600 dark:text-indigo-400';
        name.innerText = guest.nama;
        sub.innerText = `${guest.jabatan || '-'} • ${guest.rs || '-'}`;

        const customFields = (evt && Array.isArray(evt.customNumberFields)) ? evt.customNumberFields : [];
        const customNumbers = guest.customNumbers || {};
        const fieldsWithValue = customFields.filter(f => customNumbers[f.id]);

        if (fieldsWithValue.length > 0) {
            details.innerHTML = fieldsWithValue.map(f => `
                <div class="text-center py-2">
                    <p class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2">${f.label}</p>
                    <p class="text-6xl font-extrabold text-indigo-600 dark:text-indigo-400 leading-none">${customNumbers[f.id]}</p>
                </div>`).join('<div class="border-t border-dashed border-slate-200 dark:border-slate-700 my-1"></div>');
        } else {
            details.innerHTML = `<p class="text-center text-sm text-slate-400 dark:text-slate-500 italic py-2">${window.currentLang === 'id' ? 'Belum ada Nomor Khusus/Unik yang diatur untuk event ini.' : 'No Special/Unique Number has been set up for this event.'}</p>`;
        }
        // Konfirmasi visual tambahan kalau tanda tangan di Kiosk Pengambilan barusan otomatis
        // ikut menandai checkbox "Kunci Diambil" di tabel Data Peserta (lihat window.confirmKioskSignature).
        if (evt && evt.needsHotel && guest.kamar && guest.kamar !== '-' && guest.kunciDiambil) {
            details.innerHTML += `<div class="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold"><i class="fa-solid fa-circle-check"></i> ${window.currentLang === 'id' ? 'Kunci Kamar Tercatat Diambil' : 'Room Key Recorded as Picked Up'}</div>`;
        }
        details.classList.remove('hidden');
    } else if (status === 'pickup_already') {
        // Kiosk Pengambilan: Nomor Khusus/Unik milik peserta ini SUDAH PERNAH ditampilkan
        // sebelumnya (guest.pickupScanned/pickupScanTime, ditandai saat pengambilan pertama
        // benar-benar selesai - lihat window.onKioskScanSuccess & window.confirmKioskSignature).
        // Dipakai untuk mencegah pengambilan barang/kunci dua kali, sengaja maupun tidak.
        // Nomornya tetap ditampilkan di bawah (tidak disembunyikan) supaya panitia di konter
        // masih bisa memverifikasi/mencocokkan, tapi memakai warna amber & label peringatan
        // yang jelas supaya beda dari status pengambilan pertama kali (pickup_found, indigo).
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-amber-100 dark:bg-amber-500/20';
        icon.className = 'fa-solid fa-triangle-exclamation text-5xl text-amber-600 dark:text-amber-400';
        title.innerText = 'Sudah Pernah Diambil'; title.className = 'text-3xl font-extrabold mb-2 text-amber-600 dark:text-amber-400';
        name.innerText = guest.nama;
        sub.innerText = `Nomor ini sudah discan sebelumnya pukul ${guest.pickupScanTime || '-'}.`;

        const customFieldsAlready = (evt && Array.isArray(evt.customNumberFields)) ? evt.customNumberFields : [];
        const customNumbersAlready = guest.customNumbers || {};
        const fieldsWithValueAlready = customFieldsAlready.filter(f => customNumbersAlready[f.id]);

        let alreadyHtml = `<div class="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg py-2 px-3 mb-2"><i class="fa-solid fa-clock-rotate-left"></i> ${window.currentLang === 'id' ? 'Bukan yang pertama kali - mohon dicek ulang' : 'Not the first time - please double-check'}</div>`;
        if (fieldsWithValueAlready.length > 0) {
            alreadyHtml += fieldsWithValueAlready.map(f => `
                <div class="text-center py-2">
                    <p class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2">${f.label}</p>
                    <p class="text-6xl font-extrabold text-amber-600 dark:text-amber-400 leading-none">${customNumbersAlready[f.id]}</p>
                </div>`).join('<div class="border-t border-dashed border-slate-200 dark:border-slate-700 my-1"></div>');
        }
        details.innerHTML = alreadyHtml; details.classList.remove('hidden');
    } else if (status === 'check_found') {
        // Kiosk Cek Data: identitas peserta ditampilkan apa adanya lewat field yang sama dengan
        // panel hasil Kiosk Absensi (buildKioskDetailRows: Quest ID, asal, jabatan, kursi/meja),
        // TANPA embel-embel status kehadiran/pengambilan apa pun, karena mode ini murni untuk
        // pengecekan data - warna sky/biru dipakai supaya berbeda dari Kiosk Absensi (emerald)
        // & Kiosk Pengambilan (indigo).
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-sky-100 dark:bg-sky-500/20';
        icon.className = 'fa-solid fa-id-card-clip text-5xl text-sky-600 dark:text-sky-400';
        title.innerText = 'Data Ditemukan'; title.className = 'text-3xl font-extrabold mb-2 text-sky-600 dark:text-sky-400';
        name.innerText = guest.nama;
        sub.innerText = `${guest.jabatan || '-'} • ${guest.rs || '-'}`;
        details.innerHTML = buildKioskDetailRows(guest, evt); details.classList.remove('hidden');
    } else {
        iconWrap.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-red-100 dark:bg-red-500/20';
        icon.className = 'fa-solid fa-circle-xmark text-5xl text-red-600 dark:text-red-400';
        title.innerText = 'QR Tidak Dikenali'; title.className = 'text-3xl font-extrabold mb-2 text-red-600 dark:text-red-400';
        name.innerText = '';
        sub.innerText = 'Kode QR tidak ditemukan pada data peserta event ini.';
        details.innerHTML = ''; details.classList.add('hidden');
    }

    const progress = document.getElementById('kiosk-result-progress');
    const resultDurationMs = window.getKioskResetDurationSec() * 1000;
    progress.style.transition = 'none'; progress.style.width = '100%';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            progress.style.transition = `width ${resultDurationMs}ms linear`;
            progress.style.width = '0%';
        });
    });

    if (kioskResultTimer) clearTimeout(kioskResultTimer);
    kioskResultTimer = setTimeout(() => window.resetKioskToScan(), resultDurationMs);
};

window.resetKioskToScan = function() {
    if (kioskResultTimer) { clearTimeout(kioskResultTimer); kioskResultTimer = null; }
    const resultView = document.getElementById('kiosk-result-view');
    resultView.classList.add('hidden'); resultView.classList.remove('flex');
    document.getElementById('kiosk-scan-view').classList.remove('hidden');
    isKioskScanLocked = false;
    if (kioskScannerInstance) { try { kioskScannerInstance.resume(); } catch(e) {} }
};


// ===== Scan & Baca Kode (Custom QR Code Generator & Custom Barcode Generator) =====
// Fitur ini murni membaca lalu menampilkan isi kode apa adanya (tidak dicocokkan ke
// data peserta manapun), jadi disengaja dipisah dari scannerInstance/onScanSuccess yang
// dipakai untuk absensi kehadiran. Memakai ulang library html5-qrcode yang sama karena
// decoder-nya sudah mendukung QR maupun berbagai format barcode 1D sekaligus.
window.openScanReaderModal = function(mode) {
    document.getElementById('scan-reader-title-text').innerText = window.t(mode === 'barcode' ? 'modal_scan_barcode_title' : 'modal_scan_qr_title');
    document.getElementById('scan-reader-subtitle').innerText = window.t(mode === 'barcode' ? 'modal_scan_barcode_sub' : 'modal_scan_qr_sub');
    document.getElementById('scan-reader-result').classList.add('hidden');
    document.getElementById('scan-reader-camera-wrap').classList.remove('hidden');
    window.openModalAnimated('modal-scan-reader');
    // Beri jeda singkat agar #reader-scan-generic sudah ter-render di DOM (modal baru saja
    // ditampilkan) sebelum html5-qrcode mencoba mengambil alih elemen tersebut.
    setTimeout(() => {
        if (scanReaderInstance === null) {
            scanReaderInstance = new Html5QrcodeScanner("reader-scan-generic", { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true }, false);
            scanReaderInstance.render(window.onScanReaderSuccess, () => {});
        }
    }, 300);
};

window.stopScanReaderInstance = function() {
    if (scanReaderInstance) { scanReaderInstance.clear().catch(e => console.warn(e)); scanReaderInstance = null; }
};

window.closeScanReaderModal = function() {
    window.closeModalAnimated('modal-scan-reader');
    window.stopScanReaderInstance();
};

window.onScanReaderSuccess = function(decodedText) {
    window.stopScanReaderInstance();
    document.getElementById('scan-reader-camera-wrap').classList.add('hidden');

    const resultText = document.getElementById('scan-reader-result-text');
    const openLinkBtn = document.getElementById('scan-reader-open-link');
    resultText.innerText = decodedText;

    const isUrl = /^https?:\/\//i.test((decodedText || '').trim());
    if (isUrl) { openLinkBtn.href = decodedText.trim(); openLinkBtn.classList.remove('hidden'); }
    else { openLinkBtn.classList.add('hidden'); openLinkBtn.removeAttribute('href'); }

    document.getElementById('scan-reader-result').classList.remove('hidden');
    window.showToast(window.t('toast_scan_success'), 'success');
};

window.resumeScanReader = function() {
    document.getElementById('scan-reader-result').classList.add('hidden');
    document.getElementById('scan-reader-camera-wrap').classList.remove('hidden');
    if (scanReaderInstance === null) {
        scanReaderInstance = new Html5QrcodeScanner("reader-scan-generic", { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true }, false);
        scanReaderInstance.render(window.onScanReaderSuccess, () => {});
    }
};

window.copyScanResult = function() {
    const text = document.getElementById('scan-reader-result-text').innerText;
    if (!text) return;
    const doneFeedback = () => window.showToast(window.t('toast_copied'), 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(doneFeedback).catch(() => window.showToast(window.t('toast_copy_failed'), 'error'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); doneFeedback(); } catch (err) { window.showToast(window.t('toast_copy_failed'), 'error'); }
        document.body.removeChild(ta);
    }
};


// ===== Tanda Tangan Konfirmasi — Kiosk Pengambilan =====
// Mekanisme gambar identik dengan #signature-pad (bukti pengambilan kunci), tapi sengaja
// dipakai canvas & variabel terpisah karena beda konteks/modal.
window.initKioskSignaturePad = function() {
    const canvas = document.getElementById('kiosk-signature-pad');
    if (!canvas) return;
    kioskSigCanvas = canvas;
    kioskSigCtx = canvas.getContext('2d');
    isKioskSigCanvasEmpty = true;

    let isDrawing = false;
    let lastX = 0, lastY = 0;

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return [clientX - rect.left, clientY - rect.top];
    }

    function startDraw(e) {
        e.preventDefault(); isDrawing = true; isKioskSigCanvasEmpty = false;
        [lastX, lastY] = getCoords(e);
    }

    function draw(e) {
        e.preventDefault(); if (!isDrawing) return;
        const [x, y] = getCoords(e);
        kioskSigCtx.beginPath();
        kioskSigCtx.moveTo(lastX, lastY);
        kioskSigCtx.lineTo(x, y);
        kioskSigCtx.strokeStyle = '#1e293b'; // slate-800
        kioskSigCtx.lineWidth = 2.5;
        kioskSigCtx.lineCap = 'round';
        kioskSigCtx.lineJoin = 'round';
        kioskSigCtx.stroke();
        [lastX, lastY] = [x, y];
    }

    function stopDraw(e) { e.preventDefault(); isDrawing = false; }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);

    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', stopDraw, {passive: false});
};

window.clearKioskSignature = function() {
    if (kioskSigCanvas && kioskSigCtx) {
        kioskSigCtx.clearRect(0, 0, kioskSigCanvas.width, kioskSigCanvas.height);
        isKioskSigCanvasEmpty = true;
    }
};

// Membuka modal tanda tangan begitu QR peserta terbaca di Kiosk Pengambilan. Data peserta
// disimpan sementara (pendingKioskPickupGuest/Evt) untuk dipakai setelah tanda tangan
// dikonfirmasi — lihat window.confirmKioskSignature.
window.openKioskPickupSignature = function(guest, evt) {
    window.playKioskBeep('success'); // konfirmasi audio langsung begitu QR terbaca
    pendingKioskPickupGuest = guest; pendingKioskPickupEvt = evt;
    document.getElementById('kiosk-sig-guest-name').innerText = guest.nama;
    window.openModalAnimated('modal-kiosk-signature');
    setTimeout(() => {
        if (!kioskSigCanvas) window.initKioskSignaturePad(); else window.clearKioskSignature();
    }, 150);
};

// Batal menandatangani: tutup modal & kembalikan kiosk ke mode scan (kamera di-resume),
// TANPA menampilkan Nomor Khusus/Unik peserta.
window.cancelKioskSignature = function() {
    window.closeModalAnimated('modal-kiosk-signature');
    pendingKioskPickupGuest = null; pendingKioskPickupEvt = null;
    window.resetKioskToScan();
};

window.confirmKioskSignature = function() {
    if (isKioskSigCanvasEmpty) return window.showToast('Tanda tangan belum diisi!', 'error');
    window.closeModalAnimated('modal-kiosk-signature');
    const guest = pendingKioskPickupGuest, evt = pendingKioskPickupEvt;
    pendingKioskPickupGuest = null; pendingKioskPickupEvt = null;

    // Baru ditandai "sudah discan" (guest.pickupScanned/pickupScanTime) DI SINI, setelah
    // tanda tangan benar-benar dikonfirmasi - lihat catatan di window.onKioskScanSuccess.
    // saveGuests() dipanggil manual di sini (bukan cuma mengandalkan
    // window.markKeyPickupFromKiosk di bawah) karena fungsi itu langsung return tanpa
    // menyimpan apa pun kalau event ini tidak butuh data hotel.
    guest.pickupScanned = true;
    guest.pickupScanTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveGuests();

    // Checkbox "Kunci Diambil" sudah tercentang otomatis sejak QR berhasil discan (lihat
    // window.onKioskScanSuccess) - di sini tanda tangan yang baru saja dibuat hanya
    // melengkapi buktinya (kunciSignature) supaya admin bisa melihat bukti fisiknya.
    const sigData = kioskSigCanvas.toDataURL('image/png');
    window.markKeyPickupFromKiosk(guest, evt, sigData);

    window.showKioskResult('pickup_found', guest, evt);
};
