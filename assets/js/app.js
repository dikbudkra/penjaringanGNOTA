/**
 * =========================================================================
 * FRONTEND PORTAL PENJARINGAN DATA CALON PENERIMA GNOTA TAHUN 2026
 * JENJANG SMP - DISDIKBUD KABUPATEN KARANGANYAR
 * =========================================================================
 */

// TODO: Tempel URL Web App Google Apps Script setelah deploy backend/Code.gs
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzJxgQE6Puy4bAL747kD9zGQ_dQYlScXucHsK0f2SbLRqCnC6_XdSGYzdOFt4cuTJ35kg/exec";

const state = {
  config: {
    status: "BUKA",
    maxSiswa: 10,
    judulKegiatan: "Penjaringan Data Calon Penerima Bantuan GNOTA Jenjang SMP Tahun 2026",
    pesanPenutupan: ""
  },
  schools: [],
  activeSchool: null,
  students: []
};

const WORK_PRESETS = [
  "BURUH HARIAN LEPAS",
  "PETANI / BURUH TANI",
  "PEDAGANG KECIL",
  "PEKERJA SERABUTAN",
  "ASISTEN RUMAH TANGGA",
  "PENGEMUDI / OJEK",
  "KARYAWAN SWASTA / HONORER",
  "TIDAK BEKERJA",
  "YATIM / PIATU (IKUT WALI)"
];

let pdfModalInstance = null;
let passwordModalInstance = null;
let idleLogoutTimer = null;
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // Auto sign-out 20 menit tanpa aktivitas

document.addEventListener("DOMContentLoaded", () => {
  pdfModalInstance = new bootstrap.Modal(document.getElementById("pdfModal"));
  passwordModalInstance = new bootstrap.Modal(document.getElementById("changePasswordModal"));
  bindEvents();
  initApp();
});

function isApiConfigured() {
  return GAS_API_URL && GAS_API_URL.startsWith("https://script.google.com/");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hideSplash() {
  const splash = document.getElementById("splashScreen");
  if (splash) {
    setTimeout(() => splash.classList.add("hidden"), 450);
  }
}

function toggleGateSkeleton(show) {
  const skel = document.getElementById("gateSkeleton");
  const form = document.getElementById("verifyForm");
  if (skel) skel.classList.toggle("d-none", !show);
  if (form) form.classList.toggle("d-none", show);
}

function showTableSkeleton(rowsCount = 3) {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;
  const rows = [];
  for (let i = 0; i < rowsCount; i++) {
    rows.push(`
      <tr>
        <td><div class="skeleton-box skeleton-cell"></div></td>
        <td>
          <div class="skeleton-box skeleton-cell mb-2" style="width: 78%;"></div>
          <div class="skeleton-box skeleton-cell" style="width: 48%; height: 12px;"></div>
        </td>
        <td><div class="skeleton-box skeleton-cell"></div></td>
        <td>
          <div class="skeleton-box skeleton-cell mb-2" style="width: 72%;"></div>
          <div class="skeleton-box skeleton-cell" style="width: 55%; height: 12px;"></div>
        </td>
        <td><div class="skeleton-box skeleton-cell"></div></td>
        <td><div class="skeleton-box skeleton-cell"></div></td>
        <td><div class="skeleton-box skeleton-cell"></div></td>
      </tr>
    `);
  }
  tbody.innerHTML = rows.join("");
}

async function initApp() {
  if (!isApiConfigured()) {
    document.getElementById("apiWarningBanner").classList.remove("d-none");
    hideSplash();
    return;
  }

  toggleGateSkeleton(true);
  try {
    const res = await fetch(`${GAS_API_URL}?action=init`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || "Gagal memuat konfigurasi.");
    }

    state.config = data.config || state.config;
    state.schools = data.schools || [];

    if (String(state.config.status).toUpperCase() !== "BUKA") {
      document.getElementById("closedMessageText").textContent =
        state.config.pesanPenutupan || "Masa penjaringan telah ditutup.";
      document.getElementById("gateSection").classList.add("d-none");
      document.getElementById("workspaceSection").classList.add("d-none");
      document.getElementById("closedSection").classList.remove("d-none");
    } else {
      toggleGateSkeleton(false);
      restoreSavedSession();
    }
  } catch (err) {
    toggleGateSkeleton(false);
    Swal.fire({
      icon: "error",
      title: "Gagal Terhubung ke Server",
      text: err.message || "Periksa koneksi internet atau URL Google Apps Script."
    });
  } finally {
    hideSplash();
  }
}

function restoreSavedSession() {
  const saved = sessionStorage.getItem("gnota_2026_session");
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed.nama && parsed.password) {
      verifySchoolCredentials(parsed.nama, parsed.password, true);
    }
  } catch (_) {
    sessionStorage.removeItem("gnota_2026_session");
  }
}

function bindEvents() {
  const searchInput = document.getElementById("schoolSearchInput");
  const dropdown = document.getElementById("schoolDropdown");
  const clearBtn = document.getElementById("clearSchoolBtn");

  searchInput.addEventListener("input", () => {
    document.getElementById("selectedSchoolName").value = "";
    clearBtn.classList.toggle("d-none", !searchInput.value.trim());
    renderSchoolDropdown(searchInput.value);
  });

  searchInput.addEventListener("focus", () => {
    renderSchoolDropdown(searchInput.value);
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    document.getElementById("selectedSchoolName").value = "";
    clearBtn.classList.add("d-none");
    dropdown.classList.add("d-none");
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#schoolSearchInput") && !e.target.closest("#schoolDropdown")) {
      dropdown.classList.add("d-none");
    }
  });

  document.getElementById("togglePasswordBtn").addEventListener("click", () => {
    const passEl = document.getElementById("passwordInput");
    const iconEl = document.querySelector("#togglePasswordBtn i");
    const show = passEl.type === "password";
    passEl.type = show ? "text" : "password";
    iconEl.className = show ? "bi bi-eye-slash" : "bi bi-eye";
  });

  document.getElementById("verifyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isApiConfigured()) {
      Swal.fire("Belum Terkonfigurasi", "URL Google Apps Script belum diisi pada app.js.", "warning");
      return;
    }

    const namaSekolah = document.getElementById("selectedSchoolName").value.trim() || searchInput.value.trim();
    const password = document.getElementById("passwordInput").value.trim();
    if (!namaSekolah || !password) {
      Swal.fire("Lengkapi Data", "Pilih Satuan Pendidikan dan masukkan Password.", "warning");
      return;
    }
    await verifySchoolCredentials(namaSekolah, password, false);
  });

  document.getElementById("btnSwitchSchool").addEventListener("click", () => {
    performLogout(false);
  });

  // Lacak aktivitas pengguna untuk reset timer auto sign-out 20 menit
  ["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  document.getElementById("btnOpenPasswordModal").addEventListener("click", () => {
    document.getElementById("changePasswordForm").reset();
    passwordModalInstance.show();
  });

  document.getElementById("changePasswordForm").addEventListener("submit", handleChangePasswordSubmit);

  // Pekerjaan Orang Tua: Lainnya di urutan #1
  document.getElementById("pekerjaanSelect").addEventListener("change", (e) => {
    const isManual = e.target.value === "__LAINNYA__";
    const wrapper = document.getElementById("pekerjaanManualWrapper");
    const manualInput = document.getElementById("pekerjaanManual");
    wrapper.classList.toggle("d-none", !isManual);
    manualInput.required = isManual;
    if (isManual) {
      manualInput.focus();
    } else {
      manualInput.value = "";
    }
  });

  // Status PIP: Imbauan halus jika memilih Menerima
  document.getElementById("statusPip").addEventListener("change", (e) => {
    const pipWarn = document.getElementById("pipWarningBox");
    pipWarn.classList.toggle("d-none", e.target.value !== "Menerima");
  });

  // Validasi angka murni pada NISN
  document.getElementById("nisn").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  document.getElementById("btnCancelEdit").addEventListener("click", resetStudentForm);
  document.getElementById("studentForm").addEventListener("submit", handleStudentSubmit);

  document.getElementById("btnOpenPdfModal").addEventListener("click", () => {
    pdfModalInstance.show();
  });
  document.getElementById("btnGeneratePdf").addEventListener("click", generateSchoolPdf);
}

function renderSchoolDropdown(query) {
  const dropdown = document.getElementById("schoolDropdown");
  const q = String(query || "").trim().toLowerCase();
  const filtered = state.schools.filter((s) =>
    s.nama.toLowerCase().includes(q) || s.kecamatan.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="p-3 text-center small text-secondary">Sekolah tidak ditemukan.</div>`;
    dropdown.classList.remove("d-none");
    return;
  }

  dropdown.innerHTML = filtered.slice(0, 40).map((s) => `
    <div class="autocomplete-item" data-nama="${escapeHtml(s.nama)}">
      <div class="fw-semibold text-dark small">${escapeHtml(s.nama)}</div>
      <div class="text-secondary" style="font-size: 0.75rem;">
        ${escapeHtml(s.status)} &bull; Kec. ${escapeHtml(s.kecamatan)}
      </div>
    </div>
  `).join("");

  dropdown.querySelectorAll(".autocomplete-item").forEach((el) => {
    el.addEventListener("click", () => {
      const nama = el.getAttribute("data-nama");
      document.getElementById("schoolSearchInput").value = nama;
      document.getElementById("selectedSchoolName").value = nama;
      document.getElementById("clearSchoolBtn").classList.remove("d-none");
      dropdown.classList.add("d-none");
      document.getElementById("passwordInput").focus();
    });
  });

  dropdown.classList.remove("d-none");
}

async function verifySchoolCredentials(namaSekolah, password, silent) {
  const btn = document.getElementById("btnVerifySchool");
  const originalHtml = btn.innerHTML;
  if (!silent) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa...`;
  } else {
    showTableSkeleton(4);
  }

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "verifySchool",
        namaSekolah,
        password
      })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || "Login gagal.");
    }

    state.config = data.config || state.config;
    state.activeSchool = data.school;
    state.students = data.students || [];

    sessionStorage.setItem("gnota_2026_session", JSON.stringify({
      nama: state.activeSchool.nama,
      password
    }));

    enterWorkspace();
  } catch (err) {
    if (!silent) {
      Swal.fire("Login Gagal", err.message, "error");
    } else {
      sessionStorage.removeItem("gnota_2026_session");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  if (!state.activeSchool) return;

  const oldPassword = document.getElementById("oldPasswordInput").value.trim();
  const newPassword = document.getElementById("newPasswordInput").value.trim();
  const confirmPassword = document.getElementById("confirmPasswordInput").value.trim();

  if (newPassword.length < 4) {
    Swal.fire("Terlalu Pendek", "Password baru minimal 4 karakter.", "warning");
    return;
  }
  if (newPassword !== confirmPassword) {
    Swal.fire("Tidak Cocok", "Konfirmasi password baru tidak sama.", "warning");
    return;
  }

  const btn = document.getElementById("btnSavePassword");
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...`;

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "changePassword",
        npsn: state.activeSchool.npsn,
        oldPassword,
        newPassword
      })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || "Gagal mengganti password.");
    }

    sessionStorage.setItem("gnota_2026_session", JSON.stringify({
      nama: state.activeSchool.nama,
      password: newPassword
    }));
    passwordModalInstance.hide();
    Swal.fire("Berhasil", data.message, "success");
  } catch (err) {
    Swal.fire("Gagal", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function resetIdleTimer() {
  if (!state.activeSchool) return;
  if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
  idleLogoutTimer = setTimeout(() => {
    performLogout(true);
  }, IDLE_TIMEOUT_MS);
}

function stopIdleTimer() {
  if (idleLogoutTimer) {
    clearTimeout(idleLogoutTimer);
    idleLogoutTimer = null;
  }
}

function performLogout(isAutoTimeout) {
  stopIdleTimer();
  sessionStorage.removeItem("gnota_2026_session");
  state.activeSchool = null;
  state.students = [];
  document.getElementById("passwordInput").value = "";
  if (pdfModalInstance) pdfModalInstance.hide();
  if (passwordModalInstance) passwordModalInstance.hide();
  resetStudentForm();
  document.getElementById("workspaceSection").classList.add("d-none");
  document.getElementById("headerSessionBadge").classList.add("d-none");
  document.getElementById("gateSection").classList.remove("d-none");

  if (isAutoTimeout) {
    Swal.fire({
      icon: "info",
      title: "Sesi Berakhir (Auto Sign-Out)",
      text: "Anda otomatis keluar karena tidak ada aktivitas selama 20 menit."
    });
  }
}

function enterWorkspace() {
  const s = state.activeSchool;
  document.getElementById("gateSection").classList.add("d-none");
  document.getElementById("workspaceSection").classList.remove("d-none");
  document.getElementById("headerSessionBadge").classList.remove("d-none");

  document.getElementById("headerSchoolName").textContent = s.nama;
  document.getElementById("wsSchoolName").textContent = s.nama;
  document.getElementById("wsSchoolStatus").textContent = s.status;
  document.getElementById("wsSchoolNpsn").textContent = s.npsn;
  document.getElementById("wsSchoolKecamatan").textContent = s.kecamatan;
  document.getElementById("satuanPendidikan").value = s.nama;

  renderWorkspaceData();
  resetIdleTimer();
}

function renderWorkspaceData() {
  const max = Number((state.activeSchool && state.activeSchool.maxSiswa) || state.config.maxSiswa || 10);
  const count = state.students.length;
  const pct = Math.min(100, Math.round((count / max) * 100));

  document.getElementById("quotaText").textContent = `${count} / ${max} Siswa`;
  const bar = document.getElementById("quotaProgressBar");
  bar.style.width = `${pct}%`;
  bar.className = `progress-bar ${count >= max ? "bg-success" : "bg-primary"}`;

  const isEditing = Boolean(document.getElementById("editStudentId").value);
  const formCard = document.getElementById("studentFormCard");
  const quotaNotice = document.getElementById("quotaNotice");

  if (count >= max && !isEditing) {
    formCard.classList.add("d-none");
    quotaNotice.innerHTML = `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>Kuota usulan sekolah Anda sudah penuh (${max}/${max} siswa). Anda tetap dapat mengedit atau menghapus data di tabel bawah.</span>`;
  } else {
    formCard.classList.remove("d-none");
    quotaNotice.textContent = "Silakan input data calon penerima GNOTA satu per satu. Data langsung tersimpan ke server.";
  }

  document.getElementById("btnOpenPdfModal").disabled = count === 0;
  renderStudentsTable();
}

function renderStudentsTable() {
  const tbody = document.getElementById("studentsTableBody");
  if (state.students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary py-4">
          Belum ada siswa yang diusulkan oleh sekolah ini.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.students.map((st, idx) => `
    <tr>
      <td class="text-center fw-bold">${idx + 1}</td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(st.namaSiswa)}</div>
        <div class="small text-secondary">NISN: ${escapeHtml(st.nisn)}</div>
      </td>
      <td class="text-center">
        <span class="badge bg-light text-dark border">${escapeHtml(st.jenisKelamin)}</span>
        <div class="small text-secondary mt-1">${escapeHtml(st.kelas)}</div>
      </td>
      <td>
        <div class="fw-semibold text-dark">${escapeHtml(st.namaOrtu)}</div>
        <div class="small text-secondary">${escapeHtml(st.pekerjaanOrtu)}</div>
      </td>
      <td class="text-center">
        <span class="badge rounded-pill ${st.statusPip === "Menerima" ? "bg-warning-subtle text-warning-emphasis" : "bg-success-subtle text-success-emphasis"}">
          ${escapeHtml(st.statusPip)}
        </span>
      </td>
      <td class="small">${escapeHtml(st.keterangan)}</td>
      <td class="text-center">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-primary" title="Edit" onclick="startEditStudent('${escapeHtml(st.id)}')">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-outline-danger" title="Hapus" onclick="confirmDeleteStudent('${escapeHtml(st.id)}', '${escapeHtml(st.namaSiswa)}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function getSelectedPekerjaan() {
  const sel = document.getElementById("pekerjaanSelect").value;
  if (sel === "__LAINNYA__") {
    return document.getElementById("pekerjaanManual").value.trim().toUpperCase();
  }
  return sel.trim().toUpperCase();
}

async function handleStudentSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById("editStudentId").value.trim();
  const namaSiswa = document.getElementById("namaSiswa").value.trim().toUpperCase();
  const nisn = document.getElementById("nisn").value.replace(/\D/g, "").trim();
  const jenisKelamin = document.getElementById("jenisKelamin").value.trim();
  const kelas = document.getElementById("kelas").value.trim();
  const satuanPendidikan = document.getElementById("satuanPendidikan").value.trim();
  const namaOrtu = document.getElementById("namaOrtu").value.trim().toUpperCase();
  const pekerjaanOrtu = getSelectedPekerjaan();
  const statusPip = document.getElementById("statusPip").value.trim();
  const keterangan = document.getElementById("keterangan").value.trim();

  if (!namaSiswa || !nisn || !jenisKelamin || !kelas || !satuanPendidikan || !namaOrtu || !pekerjaanOrtu || !statusPip || !keterangan) {
    Swal.fire("Data Belum Lengkap", "Semua kolom wajib diisi tanpa terkecuali.", "warning");
    return;
  }

  if (!/^\d{10}$/.test(nisn)) {
    Swal.fire("NISN Tidak Valid", "NISN harus terdiri dari tepat 10 digit angka.", "warning");
    return;
  }

  const btn = document.getElementById("btnSubmitStudent");
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...`;

  try {
    showTableSkeleton(Math.max(1, state.students.length));
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveStudent",
        id: editId,
        npsn: state.activeSchool.npsn,
        satuanPendidikan,
        namaSiswa,
        nisn,
        jenisKelamin,
        kelas,
        namaOrtu,
        pekerjaanOrtu,
        statusPip,
        keterangan
      })
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.closed) {
        location.reload();
        return;
      }
      throw new Error(data.message || "Gagal menyimpan data.");
    }

    state.students = data.students || [];
    if (data.maxSiswa && state.activeSchool) {
      state.activeSchool.maxSiswa = data.maxSiswa;
    }
    resetStudentForm();
    renderWorkspaceData();

    Swal.fire({
      icon: "success",
      title: "Tersimpan!",
      text: data.message,
      timer: 1800,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire("Gagal Menyimpan", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

window.startEditStudent = function (id) {
  const st = state.students.find((item) => item.id === id);
  if (!st) return;

  document.getElementById("editStudentId").value = st.id;
  document.getElementById("namaSiswa").value = st.namaSiswa;
  document.getElementById("nisn").value = st.nisn;
  document.getElementById("jenisKelamin").value = st.jenisKelamin;
  document.getElementById("kelas").value = st.kelas;
  document.getElementById("namaOrtu").value = st.namaOrtu;
  document.getElementById("statusPip").value = st.statusPip;
  document.getElementById("pipWarningBox").classList.toggle("d-none", st.statusPip !== "Menerima");
  document.getElementById("keterangan").value = st.keterangan;

  const pekUpper = String(st.pekerjaanOrtu || "").toUpperCase();
  if (WORK_PRESETS.includes(pekUpper)) {
    document.getElementById("pekerjaanSelect").value = pekUpper;
    document.getElementById("pekerjaanManualWrapper").classList.add("d-none");
    document.getElementById("pekerjaanManual").value = "";
    document.getElementById("pekerjaanManual").required = false;
  } else {
    document.getElementById("pekerjaanSelect").value = "__LAINNYA__";
    document.getElementById("pekerjaanManualWrapper").classList.remove("d-none");
    document.getElementById("pekerjaanManual").value = pekUpper;
    document.getElementById("pekerjaanManual").required = true;
  }

  document.getElementById("formCardTitle").innerHTML = `<i class="bi bi-pencil-square me-2"></i>Edit Data Siswa`;
  document.getElementById("btnSubmitStudent").innerHTML = `<i class="bi bi-save2 me-2"></i>Simpan Perubahan`;
  document.getElementById("btnCancelEdit").classList.remove("d-none");
  document.getElementById("studentFormCard").classList.remove("d-none");
  document.getElementById("studentFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
};

function resetStudentForm() {
  document.getElementById("studentForm").reset();
  document.getElementById("editStudentId").value = "";
  if (state.activeSchool) {
    document.getElementById("satuanPendidikan").value = state.activeSchool.nama;
  }
  document.getElementById("pekerjaanManualWrapper").classList.add("d-none");
  document.getElementById("pekerjaanManual").required = false;
  document.getElementById("pipWarningBox").classList.add("d-none");
  document.getElementById("formCardTitle").innerHTML = `<i class="bi bi-person-plus-fill me-2"></i>Tambah Calon Penerima GNOTA`;
  document.getElementById("btnSubmitStudent").innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Simpan Data Siswa`;
  document.getElementById("btnCancelEdit").classList.add("d-none");
  if (state.activeSchool) {
    renderWorkspaceData();
  }
}

window.confirmDeleteStudent = async function (id, namaSiswa) {
  const result = await Swal.fire({
    icon: "warning",
    title: "Hapus Data Siswa?",
    text: `Data atas nama ${namaSiswa} akan dihapus dari daftar usulan sekolah & spreadsheet.`,
    showCancelButton: true,
    confirmButtonColor: "#DC2626",
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal"
  });

  if (!result.isConfirmed) return;

  try {
    showTableSkeleton(Math.max(1, state.students.length));
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteStudent",
        id,
        npsn: state.activeSchool.npsn
      })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || "Gagal menghapus data.");
    }
    state.students = data.students || [];
    if (data.maxSiswa && state.activeSchool) {
      state.activeSchool.maxSiswa = data.maxSiswa;
    }
    if (document.getElementById("editStudentId").value === id) {
      resetStudentForm();
    } else {
      renderWorkspaceData();
    }
    Swal.fire({
      icon: "success",
      title: "Terhapus",
      text: data.message,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire("Gagal Menghapus", err.message, "error");
  }
};

function loadImageAsDataUrl(url, asPngFromSvg = false) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 220;
      canvas.height = img.naturalHeight || 220;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function generateSchoolPdf() {
  if (!state.activeSchool || state.students.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const school = state.activeSchool;

  const [logoKra, logoGnota] = await Promise.all([
    loadImageAsDataUrl("assets/img/logo-karanganyar.png"),
    loadImageAsDataUrl("assets/img/logo-gnota.png")
  ]);

  if (logoKra) doc.addImage(logoKra, "PNG", 14, 10, 16, 18);
  if (logoGnota) doc.addImage(logoGnota, "PNG", 265, 10, 18, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(13, 71, 161);
  doc.text("DAFTAR USULAN CALON PENERIMA BANTUAN GNOTA TAHUN 2026", 148.5, 15, { align: "center" });

  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text("JENJANG SMP — DINAS PENDIDIKAN DAN KEBUDAYAAN KABUPATEN KARANGANYAR", 148.5, 21, { align: "center" });

  doc.setDrawColor(245, 124, 0);
  doc.setLineWidth(0.7);
  doc.line(14, 31, 283, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Satuan Pendidikan : ${school.nama}`, 14, 37);
  doc.text(`NPSN / Kecamatan  : ${school.npsn} / ${school.kecamatan}`, 14, 42);
  doc.text(`Jumlah Usulan     : ${state.students.length} Siswa`, 235, 37);

  const tableBody = state.students.map((st, idx) => [
    idx + 1,
    st.namaSiswa,
    st.nisn,
    st.jenisKelamin,
    st.kelas,
    st.satuanPendidikan,
    st.namaOrtu,
    st.pekerjaanOrtu,
    st.statusPip,
    st.keterangan
  ]);

  doc.autoTable({
    startY: 46,
    head: [[
      "No", "Nama Siswa", "NISN", "L/P", "Kelas",
      "Satuan Pendidikan", "Nama Orang Tua/Wali", "Pekerjaan Ortu/Wali",
      "Status PIP", "Keterangan (Alasan GNOTA)"
    ]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", textColor: [30, 41, 59] },
    headStyles: { fillColor: [13, 71, 161], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 10 },
      4: { halign: "center", cellWidth: 15 },
      8: { halign: "center", cellWidth: 22 },
      9: { cellWidth: 52 }
    }
  });

  let finalY = doc.lastAutoTable.finalY + 10;
  if (finalY > 165) {
    doc.addPage();
    finalY = 20;
  }

  const kepsek = document.getElementById("pdfKepalaSekolah").value.trim() || "...................................................";
  const nip = document.getElementById("pdfNipKepsek").value.trim() || ".......................................";
  const tgl = document.getElementById("pdfTanggal").value.trim() || "Karanganyar, ........................... 2026";

  const signX = 205;
  doc.setFontSize(9.5);
  doc.text(tgl, signX, finalY);
  doc.text("Kepala Sekolah,", signX, finalY + 5);
  doc.setFont("helvetica", "bold");
  doc.text(kepsek, signX, finalY + 25);
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${nip}`, signX, finalY + 30);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DIGITALLY SHAPED BY JeMPROT [BID SMP 2026]", 14, 202);

  const safeFile = school.nama.replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`Usulan_GNOTA_2026_${safeFile}.pdf`);
  pdfModalInstance.hide();
}
