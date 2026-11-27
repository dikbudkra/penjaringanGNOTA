# Portal Penjaringan Data Calon Penerima GNOTA Tahun 2026 (Jenjang SMP)
**Bidang SMP — Dinas Pendidikan dan Kebudayaan Kabupaten Karanganyar**

Aplikasi web penjaringan usulan calon penerima bantuan GNOTA Tahun 2026 untuk **85 SMP (Negeri & Swasta)** di Kabupaten Karanganyar (kuota maksimal **10 siswa per sekolah**).

---

## Fitur Utama
- **Verifikasi Cepat NPSN:** Operator memilih nama SMP lalu memasukkan 8 digit NPSN tanpa perlu password.
- **Form 9 Kolom Wajib:** Nama Siswa, NISN (10 digit, anti-duplikat lintas sekolah), Jenis Kelamin (L/P), Kelas (7/8/9), Satuan Pendidikan (terkunci otomatis), Nama Orang Tua/Wali, Pekerjaan Orang Tua/Wali (`Lainnya` di urutan #1), Status Penerimaan PIP (`Menerima` / `Tidak menerima`), dan Keterangan Alasan GNOTA.
- **Sinkronisasi Sheet Otomatis:** Menyimpan ke tab `Data_Keseluruhan` sekaligus membuat tab khusus `[Nama Sekolah]` secara *on-demand*.
- **Kontrol Buka/Tutup dari Spreadsheet:** Atur `BUKA` / `TUTUP` langsung di tab `Config` tanpa perlu panel admin terpisah.
- **Cetak / Unduh Bukti Usulan (PDF A4):** Dilengkapi logo Kabupaten Karanganyar, logo GNOTA, dan kolom TTD Kepala Sekolah.

---

## Cara Deploy Backend (`backend/Code.gs`)
1. Buka Spreadsheet **Data GNOTA**: `https://docs.google.com/spreadsheets/d/1epij3WOviefWj6WWIhGtYnIb3wYWGO2FVlqXn-j8BGo/edit`
2. Pilih menu **Extensions > Apps Script**.
3. Salin seluruh isi file `backend/Code.gs` ke editor Apps Script, lalu klik **Save**.
4. Klik **Deploy > New deployment > Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
5. Salin **Web app URL** yang muncul, lalu tempel ke konstanta `GAS_API_URL` di `assets/js/app.js`.

---
*DIGITALLY SHAPED BY JeMPROT [BID SMP 2026]*
