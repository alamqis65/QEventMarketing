// EventQ - User management (Admin only)
//
// Migrated from newVersion/app.js. All functions remain window.* globals.
// Passwords are never displayed in the user export; the password field is
// re-authenticated on export but only safe fields (name, username, role)
// are written to the spreadsheet. Permissions are delegated to permissions.js
// via window.openUserPermissions / window.saveUserPermissions.

window.openManageUsers = function () {
  document.getElementById("search-manage-users").value = "";
  document.getElementById("filter-manage-users").value = "all";
  window.renderManageUsers();
  window.openModalAnimated("modal-manage-users");
};

window.renderManageUsers = function () {
  const users = LS.getUsers();
  const container = document.getElementById("manage-users-list");
  const searchTerm = (
    document.getElementById("search-manage-users")?.value || ""
  ).toLowerCase();
  const filterRole =
    document.getElementById("filter-manage-users")?.value || "all";

  container.innerHTML = "";

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm) ||
      u.name.toLowerCase().includes(searchTerm);
    let matchRole = true;
    if (filterRole === "superadmin")
      matchRole = u.role === "admin" && u.isSuperAdmin;
    else if (filterRole === "admin")
      matchRole = u.role === "admin" && !u.isSuperAdmin;
    else if (filterRole === "public") matchRole = u.role === "public";
    return matchSearch && matchRole;
  });

  if (filteredUsers.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 dark:text-slate-500"><i class="fa-solid fa-users-slash text-3xl mb-3"></i><p class="text-sm font-medium" data-i18n="txt_not_found">${window.t("txt_not_found") || "Pengguna tidak ditemukan."}</p></div>`;
    return;
  }

  filteredUsers.forEach((u) => {
    const isMe = u.username === window.appState.currentUser.username;
    const isTargetSuper = u.isSuperAdmin === true;
    const amISuper = window.appState.currentUser.isSuperAdmin === true;

    const roleBadge =
      u.role === "admin"
        ? isTargetSuper
          ? '<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide border border-purple-200" title="Super Admin"><i class="fa-solid fa-crown mr-1"></i>Super Admin</span>'
          : '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide">Admin</span>'
        : '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide">Public</span>';

    // Super Admin tidak boleh dihapus sama sekali
    const canDelete = !isMe && !isTargetSuper;

    // Kredensial (username & password) hanya boleh dilihat/diubah oleh: Super Admin (lihat semua),
    // pemilik akun itu sendiri, atau untuk akun ber-role Public. Admin biasa tidak boleh melihat
    // maupun mengedit (yang berarti membuka form berisi password asli) akun Super Admin ataupun
    // sesama Admin lain — mencegah kebocoran password lewat form edit, bukan cuma lewat daftar.
    const canSeeCredentials = amISuper || isMe || u.role === "public";
    const canEdit = canSeeCredentials;

    const editBtn = canEdit
      ? `<button onclick="window.openUserForm('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-500 hover:text-amber-700 hover:bg-amber-50 flex items-center justify-center transition-colors shadow-sm" title="Edit Akun"><i class="fa-solid fa-pen text-xs"></i></button>`
      : `<button class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center cursor-not-allowed" title="Tidak ada akses edit"><i class="fa-solid fa-pen text-xs"></i></button>`;

    // Super Admin selalu memiliki akses penuh & tidak bisa dibatasi, jadi tombol Kelola Akses disembunyikan untuknya.
    // Aturan Kelola Akses Fitur:
    //  - Super Admin boleh mengubah akses fitur user Admin (non-super) maupun Public.
    //  - Admin (non-super) hanya boleh mengubah akses fitur user Public — tidak ke sesama Admin, dan tidak ke dirinya sendiri.
    const canManageAccess =
      !isTargetSuper && !isMe && (amISuper || u.role === "public");
    const permBtn = canManageAccess
      ? `<button onclick="window.openUserPermissions('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-center transition-colors shadow-sm" title="Kelola Akses Fitur"><i class="fa-solid fa-key text-xs"></i></button>`
      : "";

    const credentialsLine = canSeeCredentials
      ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium"><i class="fa-solid fa-user text-slate-400 dark:text-slate-500 mr-1"></i> ${u.username} <span class="mx-1 text-slate-300">|</span> <i class="fa-solid fa-lock text-slate-400 dark:text-slate-500 mr-1"></i> ${u.password}</p>`
      : `<p class="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium italic flex items-center gap-1"><i class="fa-solid fa-lock text-slate-300 dark:text-slate-600 mr-0.5"></i>${window.t("txt_credentials_hidden") || "Username & password disembunyikan"}</p>`;

    container.innerHTML += `
            <div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                <div>
                    <p class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center">${u.name} ${roleBadge} ${isMe ? '<span class="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md ml-1 font-bold">You</span>' : ""}</p>
                    ${credentialsLine}
                </div>
                <div class="flex gap-1.5 self-end sm:self-auto">
                    ${permBtn}
                    ${editBtn}
                    ${canDelete ? `<button onclick="window.deleteUserAcc('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm" title="Hapus Akun"><i class="fa-solid fa-trash text-xs"></i></button>` : ""}
                </div>
            </div>`;
  });
};

window.openUserForm = function (username = null) {
  const form = document.getElementById("form-manage-user");
  form.reset();
  if (username) {
    const user = LS.getUsers().find((u) => u.username === username);

    // Security check — konsisten dengan aturan visibilitas kredensial di renderManageUsers:
    // hanya Super Admin, pemilik akun sendiri, atau target ber-role Public yang boleh dibuka form editnya.
    // Ini mencegah password akun Super Admin/Admin lain bocor lewat form edit meski tombolnya
    // dipanggil langsung (bukan lewat tombol yang sudah dinonaktifkan di UI).
    const amISuper = window.appState.currentUser.isSuperAdmin === true;
    const isMe =
      window.appState.currentUser.username === username;
    if (!(amISuper || isMe || user.role === "public")) {
      return window.showToast(
        "Tidak memiliki akses untuk mengubah akun ini",
        "error",
      );
    }

    document.getElementById("user-form-title").innerText = "Edit Akun Pengguna";
    document.getElementById("mu-old-username").value = user.username;
    document.getElementById("mu-role").value = user.role || "public";
    document.getElementById("mu-name").value = user.name;
    document.getElementById("mu-username").value = user.username;
    document.getElementById("mu-password").value = user.password;
  } else {
    document.getElementById("user-form-title").innerText = "Buat Akun Baru";
    document.getElementById("mu-old-username").value = "";
    document.getElementById("mu-role").value = "public";
  }
  window.openModalAnimated("modal-user-form");
};

window.handleUserFormSubmit = function (e) {
  e.preventDefault();
  const oldUser = document.getElementById("mu-old-username").value;
  const role = document.getElementById("mu-role").value;
  const name = document.getElementById("mu-name").value.trim();
  const newUser = document.getElementById("mu-username").value.trim();
  const pass = document.getElementById("mu-password").value;
  let users = LS.getUsers();

  if (oldUser) {
    if (
      oldUser !== newUser &&
      users.find((u) => u.username === newUser)
    )
      return window.showToast("Username sudah dipakai!", "error");
    const idx = users.findIndex((u) => u.username === oldUser);
    if (idx > -1) {
      const isSuper = users[idx].isSuperAdmin; // Pertahankan hak akses Super Admin
      users[idx] = {
        ...users[idx],
        role,
        name,
        username: newUser,
        password: pass,
        isSuperAdmin: isSuper,
      };
      if (oldUser === window.appState.currentUser.username) {
        window.appState.currentUser.name = name;
        window.appState.currentUser.username = newUser;
        window.appState.currentUser.role = role;
        sessionStorage.setItem(
          "qis_session",
          JSON.stringify(window.appState.currentUser),
        );
        document.getElementById("user-display-name").innerText = name;
      }
    }
    window.showToast("Akun diperbarui!", "success");
  } else {
    if (users.find((u) => u.username === newUser))
      return window.showToast("Username sudah dipakai!", "error");
    const isFirstAdmin =
      users.filter((u) => u.role === "admin").length === 0 && role === "admin";
    users.push({
      role,
      name,
      username: newUser,
      password: pass,
      profilePic: "",
      isSuperAdmin: isFirstAdmin,
    });
    window.showToast("Akun berhasil dibuat!", "success");
  }
  LS.setUsers(users);
  window.closeModalAnimated("modal-user-form");
  window.renderManageUsers();
  window.refreshUserManageSection();
};

window.deleteUserAcc = function (username) {
  const target = LS.getUsers().find((u) => u.username === username);
  if (!target) return;
  if (target.isSuperAdmin === true) {
    window.showToast(window.currentLang === 'id' ? 'Akun Super Admin tidak dapat dihapus!' : 'The Super Admin account cannot be deleted!', 'error');
    return;
  }
  if (window.appState?.currentUser?.username === username) {
    window.showToast(window.currentLang === 'id' ? 'Akun yang sedang digunakan tidak dapat dihapus!' : 'The account currently in use cannot be deleted!', 'error');
    return;
  }
  window.openConfirmModal('user', username);
};

window.promptExportUsers = function () {
  document.getElementById("export-auth-password").value = "";
  window.openModalAnimated("modal-export-auth");
};

// Export users to Excel. Password re-auth is required for access, but the
// exported spreadsheet intentionally omits plaintext passwords — only safe
// fields (name, username, role) are written. Credentials that the exporting
// admin cannot see are masked in the export as well.
window.executeExportUsers = function (e) {
  e.preventDefault();
  const inputPass = document.getElementById("export-auth-password").value;
  const currentUser = LS.getUsers().find(
    (u) => u.username === window.appState.currentUser.username,
  );

  if (currentUser && currentUser.password === inputPass) {
    const users = LS.getUsers();
    const amISuper = currentUser.isSuperAdmin === true;
    const hiddenLabel =
      window.currentLang === "id" ? "(Disembunyikan)" : "(Hidden)";
    const exportData = users.map((u, i) => {
      // Aturan sama seperti tampilan daftar pengguna: Admin biasa tidak ikut mengekspor
      // username milik Super Admin atau sesama Admin lain, hanya miliknya sendiri & user Public.
      const canSeeUsername =
        amISuper || u.username === currentUser.username || u.role === "public";
      return {
        No: i + 1,
        "Nama Lengkap": u.name,
        Username: canSeeUsername ? u.username : hiddenLabel,
        Role:
          u.role === "admin"
            ? u.isSuperAdmin
              ? "Super Admin"
              : "Admin"
            : "Public",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar_Pengguna");
    XLSX.writeFile(wb, "Data_Akses_Pengguna.xlsx");

    window.closeModalAnimated("modal-export-auth");
    window.showToast("Data pengguna berhasil diexport!", "success");
  } else {
    window.showToast("Password tidak sesuai!", "error");
  }
};

const userText = (v) => String(v ?? "");
const userEsc = (v) => userText(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));

// Refresh the "Manajemen Pengguna" card in Settings (user count badge + summary list)
// so it always mirrors changes made inside modal-manage-users / permissions modal.
window.refreshUserManageSection = function () {
  window.updateSettingsUserCountBadge?.();
};

window.updateSettingsUserCountBadge = function () {
  const el = document.getElementById("settings-user-count");
  if (el) el.innerText = LS.getUsers().length;
  window.renderUserManageSummary?.();
};

window.renderUserManageSummary = function () {
  const container = document.getElementById("settings-user-summary-list");
  if (!container) return;
  const users = LS.getUsers();
  if (!users.length) {
    container.innerHTML = `<p class="text-sm text-slate-400 dark:text-slate-500 text-center py-4">${window.currentLang === "id" ? "Belum ada pengguna." : "No users yet."}</p>`;
    return;
  }
  container.innerHTML = users.map((u) => {
    const isTargetSuper = u.isSuperAdmin === true;
    const roleBadge = u.role === "admin"
      ? (isTargetSuper
        ? '<span class="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0"><i class="fa-solid fa-crown mr-1"></i>Super Admin</span>'
        : '<span class="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0">Admin</span>')
      : '<span class="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0">Public</span>';
    const initial = (u.name || u.username || "?").trim().charAt(0).toUpperCase();
    return `<div class="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
      <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">${initial}</div>
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate flex-1" title="${esc(u.name || u.username)}">${esc(u.name || u.username)}</span>
      ${roleBadge}
    </div>`;
  }).join("");
};
