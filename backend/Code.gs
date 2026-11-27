/**
 * =========================================================================
 * BACKEND REST API - PENJARINGAN DATA CALON PENERIMA GNOTA TAHUN 2026
 * JENJANG SMP — DINAS PENDIDIKAN DAN KEBUDAYAAN KABUPATEN KARANGANYAR
 * =========================================================================
 * Target Spreadsheet: Data GNOTA (1epij3WOviefWj6WWIhGtYnIb3wYWGO2FVlqXn-j8BGo)
 */

const SPREADSHEET_ID = "1epij3WOviefWj6WWIhGtYnIb3wYWGO2FVlqXn-j8BGo";
const SHEET_DATA_KESELURUHAN = "Data_Keseluruhan";
const SHEET_MASTER_SMP = "Master_SMP";
const SHEET_CONFIG = "Config";
const DEFAULT_MAX_SISWA = 10;

/**
 * Helper: Buka Spreadsheet target
 */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Helper: Kembalikan JSON Response untuk Web App
 */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Sanitasi anti formula/CSV injection (CWE-1236)
 */
function sanitizeCellText_(val) {
  let str = String(val === null || val === undefined ? "" : val).trim();
  if (!str) return "";
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return str;
}

/**
 * Helper: Normalisasi teks huruf kapital bersih
 */
function toUpperClean_(val) {
  return sanitizeCellText_(val).replace(/\s+/g, " ").toUpperCase();
}

/**
 * Helper: Ambil pengaturan dari tab Config
 */
function getConfigMap_(ss) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  const cfg = {
    status: "BUKA",
    maxSiswa: DEFAULT_MAX_SISWA,
    judulKegiatan: "Penjaringan Data Calon Penerima Bantuan GNOTA Jenjang SMP Tahun 2026",
    pesanPenutupan: "Masa penjaringan data calon penerima GNOTA Jenjang SMP Tahun 2026 telah ditutup."
  };
  if (!sheet) return cfg;

  const lastRow = Math.min(sheet.getLastRow(), 20);
  if (lastRow < 2) return cfg;

  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  rows.forEach(function (r) {
    const key = String(r[0] || "").trim().toUpperCase();
    const val = String(r[1] || "").trim();
    if (key === "STATUS_PENJARINGAN" && val) cfg.status = val.toUpperCase();
    if (key === "MAKS_SISWA_PER_SMP" && val) {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n > 0) cfg.maxSiswa = n;
    }
    if (key === "JUDUL_KEGIATAN" && val) cfg.judulKegiatan = val;
    if (key === "PESAN_PENUTUPAN" && val) cfg.pesanPenutupan = val;
  });
  return cfg;
}

/**
 * Helper: Ambil kuota maksimal khusus per sekolah dari Config!D2:J86 (kosong = default)
 */
function getSchoolMaxSiswa_(ss, npsn, defaultMax) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  const fallback = Number(defaultMax || DEFAULT_MAX_SISWA);
  if (!sheet || sheet.getLastRow() < 2) return fallback;

  const cleanNpsn = String(npsn || "").trim();
  const rows = sheet.getRange(2, 4, sheet.getLastRow() - 1, 7).getValues(); // D..J
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() === cleanNpsn) {
      const custom = parseInt(rows[i][6], 10); // kolom J
      if (!isNaN(custom) && custom > 0) {
        return custom;
      }
      break;
    }
  }
  return fallback;
}

/**
 * Helper: Ambil daftar Master SMP dari tab Master_SMP
 */
function getMasterSmpList_(ss) {
  const sheet = ss.getSheetByName(SHEET_MASTER_SMP);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const list = [];
  rows.forEach(function (r, idx) {
    const npsn = String(r[0] || "").trim();
    const nama = String(r[1] || "").trim();
    const status = String(r[2] || "").trim();
    const kecamatan = String(r[3] || "").trim();
    const password = String(r[4] || "").trim() || npsn;
    if (npsn && nama) {
      list.push({
        rowIndex: idx + 2,
        npsn: npsn,
        nama: nama,
        status: status,
        kecamatan: kecamatan,
        password: password
      });
    }
  });
  return list;
}

/**
 * Helper: Cari sekolah di Master_SMP berdasarkan Nama Satuan Pendidikan
 */
function findSchoolByName_(ss, namaSekolah) {
  const cleanNama = String(namaSekolah || "").trim().toUpperCase();
  const list = getMasterSmpList_(ss);
  for (let i = 0; i < list.length; i++) {
    if (list[i].nama.toUpperCase() === cleanNama) {
      return list[i];
    }
  }
  return null;
}

/**
 * Helper: Cari sekolah di Master_SMP berdasarkan NPSN
 */
function findSchoolByNpsn_(ss, npsn) {
  const cleanNpsn = String(npsn || "").trim();
  const list = getMasterSmpList_(ss);
  for (let i = 0; i < list.length; i++) {
    if (list[i].npsn === cleanNpsn) {
      return list[i];
    }
  }
  return null;
}

/**
 * Helper: Ambil semua data siswa untuk sekolah tertentu dari Data_Keseluruhan
 */
function getStudentsByNpsn_(ss, npsn) {
  const sheet = ss.getSheetByName(SHEET_DATA_KESELURUHAN);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const cleanNpsn = String(npsn || "").trim();
  const result = [];

  rows.forEach(function (r) {
    if (String(r[3] || "").trim() === cleanNpsn) {
      result.push({
        id: String(r[0] || "").trim(),
        no: r[1],
        waktuInput: String(r[2] || ""),
        npsn: String(r[3] || "").trim(),
        satuanPendidikan: String(r[4] || "").trim(),
        namaSiswa: String(r[5] || "").trim(),
        nisn: String(r[6] || "").trim(),
        jenisKelamin: String(r[7] || "").trim(),
        kelas: String(r[8] || "").trim(),
        namaOrtu: String(r[9] || "").trim(),
        pekerjaanOrtu: String(r[10] || "").trim(),
        statusPip: String(r[11] || "").trim(),
        keterangan: String(r[12] || "").trim()
      });
    }
  });
  return result;
}

/**
 * Helper: Cek duplikasi NISN di seluruh sekolah (kecuali ID yang sedang diedit)
 */
function findDuplicateNisn_(ss, nisn, excludeId) {
  const sheet = ss.getSheetByName(SHEET_DATA_KESELURUHAN);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  const cleanNisn = String(nisn || "").trim();
  for (let i = 0; i < rows.length; i++) {
    const rowId = String(rows[i][0] || "").trim();
    const rowNisn = String(rows[i][6] || "").trim();
    if (rowNisn === cleanNisn && rowId !== String(excludeId || "").trim()) {
      return {
        satuanPendidikan: String(rows[i][4] || "").trim(),
        namaSiswa: String(rows[i][5] || "").trim()
      };
    }
  }
  return null;
}

/**
 * Helper: Re-index kolom "No" pada Data_Keseluruhan
 */
function reindexDataKeseluruhan_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const count = lastRow - 1;
  const nums = [];
  for (let i = 1; i <= count; i++) {
    nums.push([i]);
  }
  sheet.getRange(2, 2, count, 1).setValues(nums);
}

/**
 * Helper: Nama tab sheet sekolah yang aman (maks 100 karakter, bebas karakter terlarang)
 */
function getSafeSchoolSheetName_(namaSekolah) {
  return String(namaSekolah || "SEKOLAH")
    .replace(/[\[\]\*\?\/\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 95);
}

/**
 * Helper: Sinkronisasi On-Demand Sheet Khusus Per Sekolah (1 Sekolah = 1 Sheet)
 */
function syncSchoolSheet_(ss, school) {
  const sheetName = getSafeSchoolSheetName_(school.nama);
  const students = getStudentsByNpsn_(ss, school.npsn);
  let schoolSheet = ss.getSheetByName(sheetName);

  // Jika siswa 0, hapus sheet sekolah agar daftar tab tetap bersih
  if (students.length === 0) {
    if (schoolSheet) {
      ss.deleteSheet(schoolSheet);
    }
    return;
  }

  if (!schoolSheet) {
    schoolSheet = ss.insertSheet(sheetName);
  } else {
    schoolSheet.clear();
  }

  // Kop Informasi Sekolah
  schoolSheet.getRange(1, 1).setValue("DAFTAR USULAN CALON PENERIMA BANTUAN GNOTA TAHUN 2026 - JENJANG SMP");
  schoolSheet.getRange(2, 1).setValue("Satuan Pendidikan: " + school.nama + " (NPSN: " + school.npsn + " | Kec. " + school.kecamatan + ")");
  schoolSheet.getRange(1, 1, 1, 10).merge().setFontWeight("bold").setFontSize(11).setFontColor("#0D47A1");
  schoolSheet.getRange(2, 1, 1, 10).merge().setFontWeight("bold").setFontSize(10).setFontColor("#334155");

  const headers = [[
    "No",
    "Nama Siswa",
    "NISN",
    "L/P",
    "Kelas",
    "Satuan Pendidikan",
    "Nama Orang Tua/Wali",
    "Pekerjaan Orang Tua/Wali",
    "Status Penerimaan PIP",
    "Keterangan (Alasan Dapat Diberikan Bantuan GNOTA)"
  ]];

  const headerRange = schoolSheet.getRange(4, 1, 1, 10);
  headerRange.setValues(headers)
    .setBackground("#0D47A1")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  const bodyRows = students.map(function (st, idx) {
    return [
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
    ];
  });

  const bodyRange = schoolSheet.getRange(5, 1, bodyRows.length, 10);
  // Format NISN sebagai Plain Text sebelum menulis
  schoolSheet.getRange(5, 3, bodyRows.length, 1).setNumberFormat("@");
  bodyRange.setValues(bodyRows).setVerticalAlignment("middle").setWrap(true);

  // Perataan kolom khusus
  schoolSheet.getRange(5, 1, bodyRows.length, 1).setHorizontalAlignment("center");
  schoolSheet.getRange(5, 3, bodyRows.length, 3).setHorizontalAlignment("center");

  // Border seluruh tabel
  schoolSheet.getRange(4, 1, bodyRows.length + 1, 10)
    .setBorder(true, true, true, true, true, true, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);

  schoolSheet.setFrozenRows(4);
  schoolSheet.autoResizeColumns(1, 10);
  schoolSheet.setColumnWidth(10, 280);
}

/**
 * Endpoint GET
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || "init").trim();
    const ss = getSpreadsheet_();

    if (action === "init") {
      const config = getConfigMap_(ss);
      const schools = getMasterSmpList_(ss).map(function (s) {
        return {
          nama: s.nama,
          status: s.status,
          kecamatan: s.kecamatan
        };
      });
      return jsonResponse_({
        ok: true,
        config: config,
        schools: schools
      });
    }

    if (action === "verifySchool") {
      return handleVerifySchool_(ss, params.namaSekolah, params.password || params.npsn);
    }

    return jsonResponse_({ ok: false, message: "Action GET tidak dikenali." });
  } catch (err) {
    return jsonResponse_({ ok: false, message: "Server Error: " + err.message });
  }
}

/**
 * Endpoint POST
 */
function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(rawBody);
    const action = String(body.action || "").trim();
    const ss = getSpreadsheet_();

    if (action === "verifySchool") {
      return handleVerifySchool_(ss, body.namaSekolah, body.password || body.npsn);
    }

    if (action === "changePassword") {
      return handleChangePassword_(ss, body);
    }

    if (action === "saveStudent") {
      return handleSaveStudent_(ss, body);
    }

    if (action === "deleteStudent") {
      return handleDeleteStudent_(ss, body);
    }

    return jsonResponse_({ ok: false, message: "Action POST tidak dikenali." });
  } catch (err) {
    return jsonResponse_({ ok: false, message: "Server Error: " + err.message });
  }
}

/**
 * Handler: Login Sekolah (Nama Sekolah + Password)
 */
function handleVerifySchool_(ss, namaSekolah, passwordInput) {
  const config = getConfigMap_(ss);
  const cleanPass = String(passwordInput || "").trim();
  const cleanNama = String(namaSekolah || "").trim().toUpperCase();

  if (!cleanPass || !cleanNama) {
    return jsonResponse_({ ok: false, message: "Pilih Satuan Pendidikan dan masukkan Password terlebih dahulu." });
  }

  const school = findSchoolByName_(ss, cleanNama);
  if (!school || school.password !== cleanPass) {
    return jsonResponse_({
      ok: false,
      message: "Password tidak sesuai dengan Satuan Pendidikan yang dipilih. Silakan periksa kembali."
    });
  }

  const students = getStudentsByNpsn_(ss, school.npsn);
  const schoolMax = getSchoolMaxSiswa_(ss, school.npsn, config.maxSiswa);
  return jsonResponse_({
    ok: true,
    config: config,
    school: {
      npsn: school.npsn,
      nama: school.nama,
      status: school.status,
      kecamatan: school.kecamatan,
      maxSiswa: schoolMax
    },
    students: students
  });
}

/**
 * Handler: Ganti Password Sekolah
 */
function handleChangePassword_(ss, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const npsn = String(body.npsn || "").trim();
    const oldPass = String(body.oldPassword || "").trim();
    const newPass = String(body.newPassword || "").trim();

    if (!npsn || !oldPass || !newPass) {
      return jsonResponse_({ ok: false, message: "Lengkapi password lama dan password baru." });
    }
    if (newPass.length < 4) {
      return jsonResponse_({ ok: false, message: "Password baru minimal 4 karakter." });
    }

    const school = findSchoolByNpsn_(ss, npsn);
    if (!school) {
      return jsonResponse_({ ok: false, message: "Data sekolah tidak ditemukan." });
    }
    if (school.password !== oldPass) {
      return jsonResponse_({ ok: false, message: "Password lama tidak sesuai." });
    }

    const masterSheet = ss.getSheetByName(SHEET_MASTER_SMP);
    const cell = masterSheet.getRange(school.rowIndex, 5);
    cell.setNumberFormat("@");
    cell.setValue(newPass);

    return jsonResponse_({
      ok: true,
      message: "Password sekolah berhasil diperbarui dan tersimpan di sistem."
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: Simpan / Perbarui Data Siswa (dengan LockService)
 */
function handleSaveStudent_(ss, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const config = getConfigMap_(ss);
    if (config.status !== "BUKA") {
      return jsonResponse_({
        ok: false,
        closed: true,
        message: config.pesanPenutupan || "Masa penjaringan telah ditutup."
      });
    }

    const npsn = String(body.npsn || "").trim();
    const school = findSchoolByNpsn_(ss, npsn);
    if (!school || school.nama.toUpperCase() !== String(body.satuanPendidikan || "").trim().toUpperCase()) {
      return jsonResponse_({ ok: false, message: "Sesi sekolah tidak valid. Silakan verifikasi ulang NPSN." });
    }

    const editId = String(body.id || "").trim();
    const namaSiswa = toUpperClean_(body.namaSiswa);
    const nisn = String(body.nisn || "").replace(/\D/g, "").trim();
    const jenisKelamin = String(body.jenisKelamin || "").trim().toUpperCase();
    const kelas = sanitizeCellText_(body.kelas);
    const namaOrtu = toUpperClean_(body.namaOrtu);
    const pekerjaanOrtu = toUpperClean_(body.pekerjaanOrtu);
    const statusPip = sanitizeCellText_(body.statusPip);
    const keterangan = sanitizeCellText_(body.keterangan);

    // Validasi wajib semua kolom
    if (!namaSiswa || !nisn || !jenisKelamin || !kelas || !namaOrtu || !pekerjaanOrtu || !statusPip || !keterangan) {
      return jsonResponse_({ ok: false, message: "Semua kolom wajib diisi lengkap tanpa terkecuali." });
    }
    if (!/^\d{10}$/.test(nisn)) {
      return jsonResponse_({ ok: false, message: "NISN harus terdiri dari tepat 10 digit angka." });
    }
    if (jenisKelamin !== "L" && jenisKelamin !== "P") {
      return jsonResponse_({ ok: false, message: "Jenis Kelamin tidak valid (harus L atau P)." });
    }

    // Cek anti-duplikat NISN lintas SMP
    const dup = findDuplicateNisn_(ss, nisn, editId);
    if (dup) {
      return jsonResponse_({
        ok: false,
        message: "NISN " + nisn + " sudah terdaftar atas nama " + dup.namaSiswa + " (" + dup.satuanPendidikan + ")."
      });
    }

    const dataSheet = ss.getSheetByName(SHEET_DATA_KESELURUHAN);
    if (!dataSheet) {
      return jsonResponse_({ ok: false, message: "Sheet Data_Keseluruhan tidak ditemukan." });
    }

    const nowWib = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
    const existingStudents = getStudentsByNpsn_(ss, school.npsn);
    const schoolMax = getSchoolMaxSiswa_(ss, school.npsn, config.maxSiswa);

    if (editId) {
      // Mode Edit
      const lastRow = dataSheet.getLastRow();
      let foundRow = -1;
      if (lastRow >= 2) {
        const idCol = dataSheet.getRange(2, 1, lastRow - 1, 4).getValues();
        for (let i = 0; i < idCol.length; i++) {
          if (String(idCol[i][0] || "").trim() === editId && String(idCol[i][3] || "").trim() === school.npsn) {
            foundRow = i + 2;
            break;
          }
        }
      }
      if (foundRow === -1) {
        return jsonResponse_({ ok: false, message: "Data siswa yang akan diubah tidak ditemukan." });
      }

      dataSheet.getRange(foundRow, 7, 1, 1).setNumberFormat("@");
      dataSheet.getRange(foundRow, 3, 1, 11).setValues([[
        nowWib,
        school.npsn,
        school.nama,
        namaSiswa,
        nisn,
        jenisKelamin,
        kelas,
        namaOrtu,
        pekerjaanOrtu,
        statusPip,
        keterangan
      ]]);
    } else {
      // Mode Tambah Baru -> Cek kuota maksimal efektif sekolah
      if (existingStudents.length >= schoolMax) {
        return jsonResponse_({
          ok: false,
          message: "Kuota sekolah sudah penuh (" + schoolMax + "/" + schoolMax + " siswa)."
        });
      }

      const newId = Utilities.getUuid();
      const nextNo = dataSheet.getLastRow();
      const targetRow = dataSheet.getLastRow() + 1;
      dataSheet.getRange(targetRow, 4, 1, 1).setNumberFormat("@");
      dataSheet.getRange(targetRow, 7, 1, 1).setNumberFormat("@");
      dataSheet.getRange(targetRow, 1, 1, 13).setValues([[
        newId,
        nextNo,
        nowWib,
        school.npsn,
        school.nama,
        namaSiswa,
        nisn,
        jenisKelamin,
        kelas,
        namaOrtu,
        pekerjaanOrtu,
        statusPip,
        keterangan
      ]]);
    }

    // Sinkronisasi sheet per sekolah (On-Demand)
    syncSchoolSheet_(ss, school);

    const updatedStudents = getStudentsByNpsn_(ss, school.npsn);
    return jsonResponse_({
      ok: true,
      message: editId ? "Data siswa berhasil diperbarui." : "Data siswa berhasil disimpan.",
      maxSiswa: schoolMax,
      students: updatedStudents
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: Hapus Data Siswa (dengan LockService)
 */
function handleDeleteStudent_(ss, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const config = getConfigMap_(ss);
    if (config.status !== "BUKA") {
      return jsonResponse_({
        ok: false,
        closed: true,
        message: config.pesanPenutupan || "Masa penjaringan telah ditutup."
      });
    }

    const npsn = String(body.npsn || "").trim();
    const editId = String(body.id || "").trim();
    const school = findSchoolByNpsn_(ss, npsn);
    if (!school || !editId) {
      return jsonResponse_({ ok: false, message: "Parameter hapus tidak lengkap." });
    }

    const dataSheet = ss.getSheetByName(SHEET_DATA_KESELURUHAN);
    const lastRow = dataSheet.getLastRow();
    let foundRow = -1;
    if (lastRow >= 2) {
      const rows = dataSheet.getRange(2, 1, lastRow - 1, 4).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0] || "").trim() === editId && String(rows[i][3] || "").trim() === school.npsn) {
          foundRow = i + 2;
          break;
        }
      }
    }

    if (foundRow === -1) {
      return jsonResponse_({ ok: false, message: "Data siswa tidak ditemukan." });
    }

    dataSheet.deleteRow(foundRow);
    reindexDataKeseluruhan_(dataSheet);
    syncSchoolSheet_(ss, school);

    const updatedStudents = getStudentsByNpsn_(ss, school.npsn);
    const schoolMax = getSchoolMaxSiswa_(ss, school.npsn, config.maxSiswa);
    return jsonResponse_({
      ok: true,
      message: "Data siswa berhasil dihapus.",
      maxSiswa: schoolMax,
      students: updatedStudents
    });
  } finally {
    lock.releaseLock();
  }
}
