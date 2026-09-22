// EventQ - Authentication (login / register / recovery / logout)
//
// Intentionally kept as simple as the original: plaintext password
// comparison against the `qis_users` record set, no hashing/JWT. Fine to
// start with; worth hardening (server-side hashing) before going public.


window.togglePasswordField = function (inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btnEl?.querySelector('i');
  const willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  if (icon) {
    icon.classList.toggle('fa-eye', !willShow);
    icon.classList.toggle('fa-eye-slash', willShow);
  }
  const label = willShow
    ? (window.currentLang === 'id' ? 'Sembunyikan password' : 'Hide password')
    : (window.currentLang === 'id' ? 'Tampilkan password' : 'Show password');
  btnEl?.setAttribute('title', label);
  btnEl?.setAttribute('aria-label', label);
};

window.setAuthRole = function (role) {
  window.authRole = role;
  document.getElementById("btn-mode-admin").className =
    role === "admin"
      ? "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 text-indigo-600 shadow-sm transition-all"
      : "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all";
  document.getElementById("btn-mode-public").className =
    role === "public"
      ? "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 text-indigo-600 shadow-sm transition-all"
      : "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all";
  document.getElementById("auth-subtitle").innerText =
    role === "admin" ? window.t("sub_admin") : window.t("sub_public");
};

window.toggleAuthMode = function (mode) {
  const forms = ["form-login", "form-register", "form-recovery"];
  forms.forEach((f) => {
    const el = document.getElementById(f);
    el.classList.remove("auth-form-active");
    el.classList.add("hidden");
  });
  let targetForm = document.getElementById("form-" + mode);
  targetForm.classList.remove("hidden");
  setTimeout(() => {
    targetForm.classList.add("auth-form-active");
  }, 10);

  const subtitle = document.getElementById("auth-subtitle");
  if (mode === "register")
    subtitle.innerText =
      window.t("txt_no_account") + " " + window.t("btn_register");
  else if (mode === "recovery") subtitle.innerText = window.t("btn_forgot_pw");
  else
    subtitle.innerText =
      window.authRole === "admin"
        ? window.t("sub_admin")
        : window.t("sub_public");
};

window.handleRecovery = function (e) {
  e.preventDefault();
  const username = document.getElementById("recovery-username").value.trim();
  const user = LS.getUsers().find((u) => u.username === username);
  if (user) {
    const role = user.role || "admin";
    recoveredUserRole = role;

    document.getElementById("rec-res-username").innerText = user.username;
    document.getElementById("rec-res-password").innerText = user.password;

    // Badge role pada hasil recovery (jika elemen tersedia di HTML)
    const badgeEl = document.getElementById("rec-res-role-badge");
    if (badgeEl) {
      if (role === "admin") {
        badgeEl.innerHTML = user.isSuperAdmin
          ? '<span class="inline-flex items-center text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border border-purple-200 dark:border-purple-500/30"><i class="fa-solid fa-crown mr-1.5"></i>Super Admin</span>'
          : '<span class="inline-flex items-center text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"><i class="fa-solid fa-user-shield mr-1.5"></i>Admin</span>';
      } else {
        badgeEl.innerHTML =
          '<span class="inline-flex items-center text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"><i class="fa-solid fa-user mr-1.5"></i>Public</span>';
      }
    }

    window.openModalAnimated("modal-recovery-result");
    document.getElementById("recovery-username").value = "";
  } else window.showToast("Mohon maaf, Username tidak ditemukan.", "error");
};

// Menutup modal hasil recovery: kembali ke form login DENGAN tab Admin/Public
// otomatis disesuaikan ke role akun yang baru ditemukan, agar login berikutnya
// tidak gagal hanya karena tab yang aktif tidak cocok dengan role akun.
window.closeRecoveryResult = function () {
  window.closeModalAnimated("modal-recovery-result");
  if (recoveredUserRole) window.setAuthRole(recoveredUserRole);
  window.toggleAuthMode("login");
};

// Menyalin username/password hasil recovery ke clipboard, dengan fallback untuk browser lama.
window.copyRecoveryField = function (fieldId, btnEl) {
  const text = document.getElementById(fieldId).innerText;
  if (!text) return;
  const showCopied = () => {
    const icon = btnEl.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-copy");
      icon.classList.add("fa-check");
      setTimeout(() => {
        icon.classList.remove("fa-check");
        icon.classList.add("fa-copy");
      }, 1200);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(showCopied)
      .catch(() => window.showToast("Gagal menyalin.", "error"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showCopied();
    } catch (err) {
      window.showToast("Gagal menyalin.", "error");
    }
    document.body.removeChild(ta);
  }
};

window.handleRegister = function (e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const users = LS.getUsers();
  if (users.find((u) => u.username === username))
    return window.showToast("Username sudah digunakan!", "error");

  // Logika Super Admin: Admin yang pertama kali dibuat / mendaftar
  const isFirstAdmin =
    users.filter((u) => u.role === "admin").length === 0 &&
    window.authRole === "admin";

  users.push({
    name,
    username,
    password,
    profilePic: "",
    role: window.authRole,
    isSuperAdmin: isFirstAdmin,
  });

  LS.setUsers(users);
  e.target.reset();
  window.toggleAuthMode("login");
  window.showToast("Registrasi berhasil!", "success");
};

window.handleLogin = function (e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const user = LS.getUsers().find(
    (u) => u.username === username && u.password === password,
  );
  if (user) {
    const userRole = user.role || "admin";
    if (userRole !== window.authRole) {
      return window.showToast(
        `Akun ini adalah User ${userRole === "admin" ? "Admin" : "Public"}! Silakan ubah opsi mode di atas.`,
        "error",
      );
    }

    window.appState.currentUser = {
      name: user.name,
      username: user.username,
      profilePic: user.profilePic || "",
      role: userRole,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions || {},
    };
    sessionStorage.setItem(
      "qis_session",
      JSON.stringify(window.appState.currentUser),
    );
    e.target.reset();
    window.setLoadingText("txt_loading");
    switchMainViewAnimated("view-loading");
    setTimeout(() => {
      loadLibrary();
      window.tryLaunchPendingKiosk();
    }, 1200);
  } else window.showToast("Username atau Password salah!", "error");
};

window.handleLogout = function () {
  window.appState.currentUser = null;
  sessionStorage.removeItem("qis_session");
  switchMainViewAnimated("view-auth");
};
