# Grammarise

Belajar English tanpa bikin kepala pusing. Dibuat buat **LOGICODIX 2026**.

Grammarise itu web belajar English buat kamu yang males baca English. Soalnya pendek, ada hati dan XP, ada badge juga. Rasanya kayak main game, bukan kayak belajar.

---

## Daftar isi

1. [Masalahnya apa](#masalahnya-apa)
2. [Solusi kita](#solusi-kita)
3. [Buat siapa](#buat-siapa)
4. [Fitur](#fitur)
5. [Teknologi](#teknologi)
6. [Arsitektur](#arsitektur)
7. [Flowchart](#flowchart)
8. [UML](#uml)
9. [ERD](#erd)
10. [Cara install](#cara-install)
11. [Kontributor](#kontributor)

---

## Masalahnya apa

Banyak anak muda pengen jago English, tapi males baca teks panjang. Belajar jadi berat, terus berhenti di tengah jalan.

Duolingo sudah terbukti bikin orang betah belajar. Jadi kita **gak buang waktu bikin ulang hal yang sudah jalan**. Kita ambil pola yang sudah terbukti, terus kita isi 2 celah yang Duolingo kunci di balik tembok bayar.

## Solusi kita

**Celah pertama: soal latihan AI yang jelas asalnya.**
Soal latihan AI kita dipilih dari topik yang paling sering kamu salah. Jadi kamu tahu soal itu muncul bukan asal-asalan. Misalnya kamu sering salah di Past Tense, maka soal Past Tense yang lebih sering muncul. Setiap soal juga nunjukin topiknya dan asalnya, dari AI atau dari bank soal.

**Celah kedua: AI yang ngoreksi jawaban tulis dan terjemahan, gratis.**
Di Duolingo, fitur ini ada di paket berbayar (Duolingo Max). Di Grammarise, fitur ini ada di versi gratis dari awal.

Jadi bukan bikin ulang Duolingo. Kita ambil pola yang sudah terbukti, terus kita isi 2 celah yang sengaja mereka kunci.

## Buat siapa

Buat Gen Z yang males baca English.

---

## Fitur

| Fitur | Penjelasan singkat |
|---|---|
| Login | Bisa pakai email dan password, bisa juga pakai Google |
| Course, unit, lesson | Materi dibagi per unit, tiap unit isinya beberapa lesson pendek |
| Soal lesson | Pilihan ganda, isian, dan terjemahan |
| Koreksi AI | Jawaban isian dan terjemahan dikoreksi AI, gratis |
| Latihan AI | Soal dibuat AI dari topik yang sering kamu salah. Butuh minimal 10 XP buat buka |
| Review | Soal yang pernah salah masuk antrean buat diulang. Benar dapat +5 XP |
| Hati | Maksimal 5. Salah di lesson kehilangan 1 hati. Hati balik pelan-pelan |
| XP | Benar nambah XP, salah di lesson ngurangin XP |
| Streak | Hitung hari belajar berturut-turut |
| Badge | Ada 4 badge, lihat tabel di bawah |

### Badge

| Badge | Cara dapat |
|---|---|
| Miss Mulu | Salah 6 kali berturut-turut di lesson (lebih dari 5 kali) |
| Mulai Serius Nih | Benar 4 kali berturut-turut di lesson |
| Calon Juara | Total XP sampai 450 |
| Sang Juara | Total XP sampai 1800. Harus sudah punya Calon Juara dulu |

Badge yang sudah didapat gak pernah dicabut, walau XP turun.

---

## Teknologi

| Bagian | Pakai apa |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Motion, Lenis, lucide-react |
| Backend | Python, FastAPI, Pydantic |
| Database | Supabase (PostgreSQL) |
| Login | Email dan password (JWT di cookie), Google lewat Supabase Auth |
| AI | OpenRouter |
| Penilaian lokal | RapidFuzz |
| Cache | cachetools |

---

## Arsitektur

Frontend ngobrol ke backend lewat REST API. Cuma backend yang boleh ngobrol ke database pakai kunci rahasia, dan cuma backend yang boleh manggil AI.

```mermaid
flowchart LR
    U([Pengguna]) --> FE

    subgraph Frontend
        FE[React + Vite<br/>port 5173]
    end

    subgraph Backend
        API[FastAPI<br/>port 8000]
        AUTH[Auth router]
        ROUTES[Routes<br/>course, lesson, review,<br/>progress, ai]
        SERVICES[Services<br/>grading, ai, progress,<br/>milestone, unlock]
        API --> AUTH
        API --> ROUTES
        ROUTES --> SERVICES
    end

    subgraph Layanan luar
        DB[(Supabase<br/>PostgreSQL)]
        GAUTH[Supabase Auth<br/>login Google]
        OR[OpenRouter<br/>model AI]
    end

    FE -- "REST + cookie JWT" --> API
    FE -. "login Google<br/>(anon key saja)" .-> GAUTH
    AUTH --> DB
    SERVICES --> DB
    SERVICES --> OR
```

---

## Flowchart

### Alur jawab soal di lesson

```mermaid
flowchart TD
    A([Mulai lesson]) --> B{Hati masih ada?}
    B -- Tidak --> X[Tampil: hati habis<br/>tunggu hati balik]
    B -- Ya --> C[Tampil soal]
    C --> D[Kamu jawab]
    D --> E{Tipe soal?}
    E -- Pilihan ganda --> F[Cek jawaban langsung]
    E -- Isian atau terjemahan --> G[Cek lokal dulu:<br/>huruf kecil, tanda baca dibuang,<br/>cocokin ke semua kunci]
    G --> H{Cocok?}
    H -- Ya --> I[Benar]
    H -- Tidak --> J[AI yang ngoreksi<br/>+ kasih saran]
    J --> K{AI bilang benar<br/>atau cuma typo kecil?}
    K -- Ya --> I
    K -- Tidak --> L[Salah]
    F --> M{Benar?}
    M -- Ya --> I
    M -- Tidak --> L
    I --> N[Tambah XP<br/>streak benar +1<br/>streak salah jadi 0]
    L --> O[Kurangi XP dan 1 hati<br/>soal masuk antrean Review<br/>streak salah +1<br/>streak benar jadi 0]
    N --> P[Cek badge]
    O --> P
    P --> Q{Soal habis?}
    Q -- Belum --> B
    Q -- Sudah --> R([Lesson selesai<br/>lesson berikutnya kebuka])
```

### Alur Latihan AI

```mermaid
flowchart TD
    A([Buka Latihan AI]) --> B{Sudah selesai<br/>minimal 1 lesson<br/>dan XP minimal 10?}
    B -- Belum --> X[Tampil pesan<br/>selesaikan lesson dulu]
    B -- Sudah --> C[Pilih topik, tipe soal,<br/>dan jumlah soal]
    C --> D{Pilih otomatis?}
    D -- Ya --> E[Hitung topik lemah<br/>dari riwayat jawaban]
    D -- Tidak --> F[Pakai topik pilihanmu]
    E --> G[AI bikin soal lewat OpenRouter]
    F --> G
    G --> H{Soal lolos cek?<br/>tidak dobel, tidak kosong,<br/>jawaban masuk akal}
    H -- Tidak --> I[Coba lagi<br/>atau pakai soal dari bank soal]
    I --> H
    H -- Ya --> J[Tampil soal]
    J --> K[Kamu jawab]
    K --> L{Benar?}
    L -- Ya --> M[+14 XP]
    L -- Tidak --> N[-5 XP]
    M --> O{Soal habis?}
    N --> O
    O -- Belum --> J
    O -- Sudah --> P([Selesai])
```

---

## UML

### Use case

```mermaid
flowchart LR
    P([Pelajar])
    AI([AI OpenRouter])

    subgraph Grammarise
        U1(Daftar dan login)
        U2(Lihat course dan unit)
        U3(Kerjain lesson)
        U4(Latihan AI)
        U5(Ulang soal di Review)
        U6(Lihat progress dan badge)
        U7(Koreksi jawaban tulis)
        U8(Bikin soal)
    end

    P --- U1
    P --- U2
    P --- U3
    P --- U4
    P --- U5
    P --- U6
    U3 -. include .-> U7
    U4 -. include .-> U8
    U7 --- AI
    U8 --- AI
```

### Sequence: jawab soal terjemahan

```mermaid
sequenceDiagram
    actor P as Pelajar
    participant FE as Frontend
    participant API as FastAPI
    participant G as grading_service
    participant AI as OpenRouter
    participant DB as Supabase

    P->>FE: Kirim jawaban terjemahan
    FE->>API: POST /lessons/{id}/attempt/translate
    API->>DB: Cek hati dan ambil soal
    API->>G: Nilai jawaban
    G->>G: Cek lokal ke semua kunci
    alt Belum cocok
        G->>AI: Minta koreksi
        AI-->>G: Benar atau salah + saran
    end
    G-->>API: Hasil nilai
    API->>DB: Update XP, hati, streak, antrean Review
    API->>DB: Cek dan simpan badge baru
    API-->>FE: Benar atau salah, saran, sisa hati, badge baru
    FE-->>P: Tampil hasil
```

### Class diagram

```mermaid
classDiagram
    class ApiResponse {
        +bool success
        +data
        +error
    }
    class AttemptResultOut {
        +bool is_correct
        +int xp_earned
        +BadgeOut badge_earned
    }
    class BadgeOut {
        +UUID badge_id
        +str name
        +str code
        +str criteria_type
        +int criteria_value
        +datetime earned_at
    }
    class HeartStateOut {
        +int hearts_remaining
    }
    class ExercisePublicOut {
        +UUID exercise_id
        +str type
        +str topic
        +str question
        +list options
    }
    class LessonDetailOut {
        +UUID lesson_id
        +UUID unit_id
        +int order_index
        +int xp_reward_base
    }
    class QuizQuestionItemOut {
        +UUID question_id
        +str topic
        +str question_text
        +str source
    }

    HeartStateOut <|-- LessonDetailOut
    LessonDetailOut o-- ExercisePublicOut
    AttemptResultOut o-- BadgeOut
    ApiResponse ..> AttemptResultOut : data
```

---

## ERD

Ini tabel-tabel utama di database. Ada dua tempat nyimpen akun: `app_user` buat email dan password, `auth.users` buat Google. Karena itu tabel progres gak dikunci foreign key ke satu tabel user saja, jadi dua jenis akun sama-sama bisa dipakai.

```mermaid
erDiagram
    APP_USER {
        uuid user_id PK
        text email
        text password_hash
        timestamptz created_at
    }
    USER_PROGRESS {
        uuid user_id PK
        int total_xp
        int current_streak
        int hearts_remaining
        uuid current_lesson_id
        jsonb heart_regen_timestamps
        int lesson_correct_streak
        int lesson_wrong_streak
    }
    COURSE {
        uuid course_id PK
        text title
    }
    UNIT {
        uuid unit_id PK
        uuid course_id FK
        text title
        int order_index
    }
    LESSON {
        uuid lesson_id PK
        uuid unit_id FK
        int order_index
        int xp_reward_base
    }
    EXERCISE {
        uuid exercise_id PK
        uuid lesson_id FK
        text type
        text topic
        text question
        jsonb options
        text expected_answer
    }
    LESSON_COMPLETION {
        uuid user_id
        uuid lesson_id FK
        timestamptz completed_at
    }
    REVIEW_QUEUE {
        uuid review_id PK
        uuid user_id
        uuid exercise_id FK
        uuid ai_exercise_id
        timestamptz added_at
    }
    ATTEMPT_LOG {
        uuid user_id
        text topic
        bool is_correct
        timestamptz created_at
    }
    TOPIC_SCORE {
        uuid user_id
        text topic
    }
    BADGE {
        uuid badge_id PK
        text code
        text name
        text criteria_type
        int criteria_value
    }
    USER_BADGE {
        uuid user_id
        uuid badge_id FK
        timestamptz earned_at
    }

    COURSE ||--o{ UNIT : punya
    UNIT ||--o{ LESSON : punya
    LESSON ||--o{ EXERCISE : punya
    LESSON ||--o{ LESSON_COMPLETION : diselesaikan
    EXERCISE ||--o{ REVIEW_QUEUE : masuk_antrean
    BADGE ||--o{ USER_BADGE : dimiliki
    APP_USER ||--o| USER_PROGRESS : punya
    APP_USER ||--o{ LESSON_COMPLETION : selesai
    APP_USER ||--o{ REVIEW_QUEUE : antrean
    APP_USER ||--o{ ATTEMPT_LOG : riwayat
    APP_USER ||--o{ TOPIC_SCORE : skor_topik
    APP_USER ||--o{ USER_BADGE : punya_badge
```

Catatan: kolom `user_id` di tabel progres bisa nunjuk ke `app_user` atau ke `auth.users` (akun Google). Di diagram, semuanya digambar ke `APP_USER` biar mudah dibaca.

---

## Cara install

### Yang harus ada dulu

- Git
- Python 3.11 atau lebih baru
- Node.js 20 atau lebih baru
- Akun [Supabase](https://supabase.com)
- Akun [OpenRouter](https://openrouter.ai) buat API key

### 1. Clone repo

```bash
git clone https://github.com/jojohyperbackend-hub/ENduckLearning.git
cd ENduckLearning
```

### 2. Jalanin backend

```bash
cd backend
python -m venv .venv
```

Aktifin venv:

```bash
# Mac atau Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

Install paket dan jalanin:

```bash
pip install -r requirements.txt
```

Bikin file `backend/.env.local`, isinya:

```env
SUPABASE_URL=isi_url_supabase_kamu
SUPABASE_ANON_KEY=isi_anon_key
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key
OPENROUTER_API_KEY=isi_api_key_openrouter
JWT_SECRET=isi_teks_acak_yang_panjang
ENVIRONMENT=development
```

Nyalain servernya:

```bash
uvicorn app.main:app --reload --port 8000
```

Buka `http://localhost:8000`. Kalau muncul `backend berjalan`, berarti aman.

### 3. Jalanin frontend

Buka terminal baru:

```bash
cd frontend
npm install
```

Bikin file `frontend/.env.local`, isinya:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=isi_url_supabase_kamu
VITE_SUPABASE_ANON_KEY=isi_anon_key
```

Jalanin:

```bash
npm run dev
```

Buka `http://localhost:5173`.

---

## Kontributor

| Nama | Role |
|---|---|
| Ata Jauza | Full stack dan leader |
| Anas Faiq | Front end |
| Khidir Ali | Backend |
| Gabe | UI UX |
