# Deutsch Adventure: Aturan Proyek (WAJIB DIBACA SEBELUM MENULIS KODE)

Game kuis Bahasa Jerman multiplayer ala Mario Bros, lokal network saja, join pakai room code seperti Kahoot.

**Prioritas #1: tampilan harus terlihat seperti game pixel art buatan manusia, BUKAN website/AI generik.**
Jika ragu antara "cepat jadi" dan "terlihat benar", pilih terlihat benar.

---

## 1. Stack (jangan diganti tanpa izin)

- Layar utama (TV/laptop host): **Phaser 3** + Vite
- Server: **Node.js + Express + Socket.IO**
- Controller HP: HTML/CSS/JS biasa + nipple.js (joystick)
- Level: dibuat di **Tiled**, diexport **JSON**, dimuat dengan `this.make.tilemap`
- Server adalah sumber kebenaran (authoritative) untuk skor, soal, dan jawaban. Client tidak boleh menghitung skor.

---

## 2. ATURAN ASET (penyebab utama hasil jelek sebelumnya)

1. **DILARANG menggambar sprite, tile, background, ikon, atau karakter dengan kode** (tidak boleh `graphics.fillRect` sebagai pengganti karakter/tile, tidak boleh SVG buatan sendiri, tidak boleh emoji sebagai ikon).
2. **Hanya pakai aset dari folder `public/assets/`** yang ditaruh user (Kenney.nl / itch.io, lisensi CC0 atau sejenisnya).
3. **Sebelum memakai aset, WAJIB lihat isi foldernya** (`ls`/list files) dan baca ukuran frame/tile aslinya. Dilarang menebak nama file atau ukuran frame.
4. Jika aset yang dibutuhkan tidak ada (misal: sprite block "?", pipa, koin), **BERHENTI dan beri tahu user** aset apa yang kurang. Jangan membuat pengganti sendiri.
5. **Satu pack = satu ukuran tile.** Jangan mencampur pack dengan ukuran tile berbeda (misal 16px dan 18px) dalam satu scene. Semua tile, karakter, dan item harus se-skala.
6. Catat semua aset yang dipakai dan lisensinya di `CREDITS.md`.

---

## 3. ATURAN RENDER PIXEL ART

Wajib di config Phaser:

```js
{
  pixelArt: true,        // filter NEAREST, tidak blur
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } }
}
```

- Resolusi dasar game kecil (contoh 480x270 atau 320x180) lalu di-scale **kelipatan bilangan bulat** (2x, 3x, 4x). Dilarang scale pecahan yang bikin pixel tidak rata.
- Semua `<canvas>`, `<img>` dan elemen pixel art di HTML/CSS wajib `image-rendering: pixelated;`.
- Tidak boleh ada blur, drop shadow lembut, glow, atau anti-aliasing pada elemen game.
- Posisi sprite dibulatkan ke integer.

---

## 4. ATURAN TAMPILAN VISUAL

**Palet warna:** tentukan satu palet maksimal 8 warna di `src/theme.js` (hex) dan hanya pakai warna dari sana. Tidak boleh menambah warna acak.

**Font:** hanya satu font pixel (**Press Start 2P** atau **Pixelify Sans**), disimpan lokal di `public/fonts/` (jaringan lokal = tidak ada internet, JANGAN pakai Google Fonts CDN). Ukuran font kelipatan 8px.

**UI (HUD, tombol, panel soal):**
- Pakai aset UI pixel dari Kenney (misal *UI Pack Pixel Adventure*) atau 9-slice dari aset itu.
- Tombol: kotak bersudut tegas, border pixel tebal 2-4px, ada state normal/hover/pressed yang jelas.
- Panel soal gaya kayu/batu/blok seperti mockup, bukan kartu putih modern.

**Latar:** background parallax berlapis (langit, awan, gunung, pohon) dari aset, bergerak dengan kecepatan berbeda. Tidak boleh gradient CSS polos.

**Animasi:** gunakan spritesheet yang tersedia (idle, run, jump). Block "?" punya animasi berkedip dan berubah jadi block kosong setelah dipukul. Koin berputar. Beri screen shake kecil dan efek partikel pixel saat jawaban benar.

---

## 5. DAFTAR LARANGAN (ciri khas AI slop)

- ❌ Gradient ungu/biru atau glassmorphism
- ❌ Kartu putih bersudut bulat dengan shadow lembut
- ❌ Emoji sebagai ikon atau karakter
- ❌ Font default (Arial, Inter, system-ui, Roboto) di dalam game
- ❌ Tombol generik gaya Bootstrap/Tailwind
- ❌ Karakter berupa kotak/lingkaran berwarna
- ❌ Teks "Welcome to...", "Let's get started!", atau teks pengisi lain yang tidak diminta
- ❌ Animasi fade/slide halus gaya website (pakai step animation ala game)
- ❌ Mengubah desain yang sudah disetujui user tanpa diminta
- ❌ Menambah fitur di luar yang diminta

---

## 6. ALUR GAMEPLAY

1. Host membuka `/host` → muncul room code 4-6 karakter + QR + IP lokal.
2. Pemain membuka `/play` di HP (satu WiFi), isi nama + kode, lalu pilih karakter.
3. HP mengirim input (kiri, kanan, lompat) via Socket.IO. Karakter bergerak di layar host.
4. Pemain memukul block "?" dari bawah → server kirim soal hanya ke HP pemain itu (timer 15 detik, 4 pilihan A-D).
5. Jawaban benar = +100 poin (bonus kecepatan boleh). Salah = 0. Block berubah jadi kosong dan respawn setelah beberapa detik.
6. Leaderboard live di layar host. Saat waktu habis, tampilkan podium. Skor tertinggi menang.

Soal disimpan di `server/questions.json` (kategori, pertanyaan, 4 opsi, index jawaban benar, tingkat kesulitan).

---

## 7. STRUKTUR FOLDER

```
/server        index.js, rooms.js, questions.json
/client-host   Phaser game (scenes: Boot, Lobby, Game, Result)
/client-play   controller HP
/public/assets sprites, tilesets, ui, audio (dari Kenney/itch.io)
/public/fonts  font pixel lokal
/tiled         file .tmx dan .json level
CREDITS.md
```

---

## 8. CARA KERJA (PROSES WAJIB)

- Kerjakan **satu langkah per tugas**, jangan semuanya sekaligus:
  1. Boot scene + load aset + tampilkan satu tile dan karakter dengan benar
  2. Level dari Tiled + kamera + parallax
  3. Gerak dan lompat karakter (keyboard dulu)
  4. Block "?" + popup soal
  5. Server + room code + controller HP
  6. Multiplayer banyak karakter + skor + leaderboard
  7. Polish: suara, partikel, animasi
- Setelah tiap langkah: **jalankan game, ambil screenshot, bandingkan dengan `mockup.jpg`**, lalu jelaskan perbedaannya. Jangan klaim "selesai" jika tampilan belum cocok.
- Jika tampilan terlihat buram, tidak rata, atau skalanya campur aduk, perbaiki dulu sebelum lanjut ke fitur berikutnya.
- Jika tidak yakin soal desain, **tanya user**, jangan mengarang.

---

## 9. CHECKLIST SEBELUM BILANG "SELESAI"

- [ ] Tidak ada sprite/tile/ikon buatan kode, semua dari `public/assets`
- [ ] `pixelArt: true` aktif, tidak ada blur sama sekali
- [ ] Skala game kelipatan bilangan bulat
- [ ] Semua warna dari `theme.js`, satu font pixel lokal
- [ ] Tidak ada item dari daftar larangan (bagian 5)
- [ ] Berjalan tanpa internet (tanpa CDN)
- [ ] Bisa diakses dari HP lewat IP lokal
- [ ] Screenshot sudah dibandingkan dengan `mockup.jpg`
- [ ] `CREDITS.md` terisi
