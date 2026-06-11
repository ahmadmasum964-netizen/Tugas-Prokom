# Aplikasi Kas Organisasi

Aplikasi ini adalah sistem pencatatan laporan keuangan organisasi dengan fitur:

- Bayar kas (setor kas) langsung dari web
- Catat pengeluaran organisasi
- Laporan pengeluaran dan kas masuk real-time
- Ringkasan pengguna per anggota
- Ringkasan global organisasi

## Instalasi

1. Buka terminal di folder `Tugas-Prokom`
2. Jalankan:

```bash
npm install
```

## Menjalankan Aplikasi

```bash
npm start
```

Buka browser di `http://localhost:3000`

> Penting: gunakan `http://`, bukan `https://`, karena server ini hanya berjalan dengan HTTP pada `localhost`.
> Jika ingin membuat server dapat diakses dari internet langsung, jalankan tunnel publik dengan `npm run tunnel` dan buka URL yang muncul.
> Jika menggunakan container atau Codespace, pastikan port `3000` sudah diforward / dibuka.
> Jika muncul kesalahan `site can't be reached`, hentikan proses Node lain yang menggunakan port 3000 atau jalankan dengan port lain:
>
> ```bash
> PORT=3001 npm start
> ```

## Penggunaan

- Masukkan nama anggota untuk mulai menggunakan.
- Isi transaksi jenis `Bayar Kas` untuk setor kas.
- Isi transaksi jenis `Pengeluaran` untuk mencatat biaya.
- Laporan akan tampil secara real-time untuk semua pengguna yang terhubung.

## Deploy ke hosting publik

Agar aplikasi bisa diakses dari perangkat mana pun dan jaringan mana pun, silakan deploy ke layanan hosting publik.

### Pilihan cepat

1. Buat akun di Render.com atau layanan hosting Node.js lain.
2. Hubungkan repository GitHub `ahmadmasum964-netizen/Tugas-Prokom`.
3. Pilih branch `main` dan gunakan `npm install` / `npm start`.
4. Pada Render, alamat akan tersedia secara publik seperti `https://kas-organisasi.onrender.com`.

### Konfigurasi yang sudah disiapkan

- `Dockerfile` untuk deploy lewat Docker
- `.dockerignore` untuk mengecualikan file yang tidak perlu
- `Procfile` untuk deploy ke layanan Heroku-like
- `render.yaml` untuk deploy otomatis ke Render

## Struktur

- `server.js`: server Express + Socket.io
- `db.js`: manajemen database SQLite
- `public/`: frontend HTML, CSS, JavaScript
- `package.json`: dependensi proyek
- `kas.db`: basis data SQLite (otomatis dibuat saat pertama dijalankan)
