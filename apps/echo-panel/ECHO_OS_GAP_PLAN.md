# ECHO OS — ReviewPro Paritesi Gap Planı

> Hedef: ECHO OS (`(os)/*` lens sistemi) ile ReviewPro arasındaki feature
> boşluklarını kapatmak. **Hedef UI = `(os)` lens sistemi** (klasik `(app)/*`
> panel zamanla emekliye ayrılır). **Veri = mock-first**, `[MOCK→radar]`
> etiketiyle — backend hazır olunca bağlanır. Mevcut `ECHO_OS_PLAN.md`
> kararlarıyla hizalı.

## Doğrulama özeti (kod taramasıyla)

Kullanıcının ReviewPro-eksik listesi 4 paralel ajanla doğrulandı. Düzeltmeler:

| İddia | Gerçek durum (kanıt) |
|---|---|
| Trend grafiği yok | ✅ **VAR** (os) — `TrendChart` /os:208, /os/department:70 (mock) |
| Hedefler (Goals) yok | ⚠️ **KISMİ** — `GoalProgress` /os/department:73 gösterim; *oluşturma* UI yok |
| Semantic mentions yok | ⚠️ **KISMİ** — `MentionList`+`PolarityHistogram` özet; cümle-düzeyi yok |
| Management Response analytics | ❌ **YOK** — sadece tek "cevap oranı" KPI'sı |
| Top Concept Trends | ❌ **YOK** — backend'de `concept_key` field var, UI yok |
| Results breakdown (dil/ülke/seyahat) | ⚠️ Dil filtresi (app)/reviews'te VAR; seyahat tipi detail'de VAR; ülke/platform-ranking YOK |
| CQI / Competition derinliği | ❌ **YOK** |

**Plan dışı keşfedilen kırık noktalar (öncelikli):**
- 🔴 `LensTabs` → `/os/competitors` ve `/os/departments`'a link veriyor ama **bu route'lar YOK** (kırık link).
- 🔴 Platform sayfasındaki alt-tab'lar (Kategoriler/Yorumlar/Rakipler) **dekoratif** — `activeTab` değişiyor ama içerik render edilmiyor.
- 🟢 Rakip verisi `getCompetitorScores()` ile **zaten canlı backend'den** geliyor (benchmark'ta kullanılıyor) — `/os/competitors` mock'a gerek olmadan buna bağlanabilir.

## Kapsam kararları (onaylı)
- **Hedef UI:** `(os)` lens sistemi.
- **Veri:** mock-first + `[MOCK→radar]`; rakip için mevcut canlı `getCompetitorScores`.
- **Component yeri:** `apps/echo-panel/src/lib/components`.

---

## Faz 1 — Kırık linkleri kapat (🔴 önce bunlar)

Mevcut navigasyon kırık; yeni feature eklemeden önce iskeleti sağlamlaştır.

### 1.1 `/os/competitors` lens (Rakipler)
- **Yeni:** `routes/(os)/os/competitors/+page.svelte` + `+page.ts`
- **Veri:** `getCompetitorScores(venueSlug, period, token)` (CANLI) + blended GPI.
- **İçerik:**
  - GPI sıralaması (kendi otel vurgulu) — benchmark'taki bar mantığı, lens'e taşı.
  - Kategori heatmap (12 kategori × rakip) — `(app)/benchmark`'tan taşı/yeniden kullan.
  - **CQI (Competitive Quality Index)** kartı — `[MOCK→radar]` (rakip-ortalamasına göre normalize skor).
  - Departman/dil kırılımı — `[MOCK→radar]` placeholder, ileride.
- **Not:** `(app)/benchmark` mantığının çoğu yeniden kullanılabilir; kopyala-rafine et.

### 1.2 `/os/departments` lens (Departman listesi)
- **Yeni:** `routes/(os)/os/departments/+page.svelte` + `+page.ts`
- **Veri:** `MOCK_OS_DEPTS` (os.ts) + `DEPARTMENTS` (departments.ts) — mevcut mock.
- **İçerik:** `DeptCard` grid (her departman skor + trend + hedef durumu); tıkla → `/os/department/[dept]` (zaten var).
- **Etki:** Departmanlar lens'i artık gerçek bir giriş sayfası; `DeptCard` component'i zaten mevcut.

### 1.3 Platform alt-tab'larını işlevsel yap
- **Dosya:** `routes/(os)/os/platform/[platform]/+page.svelte`
- Şu an `activeTab` sadece görsel. Her tab'a içerik bağla:
  - **Genel** (mevcut hero+dağılım+kategoriler) — varsayılan.
  - **Kategoriler** — tam kategori listesi (CategoryBar).
  - **Yorumlar** — o platformun yorumları (reviews API, platform filtresi).
  - **Rakipler** — o platformda rakip kıyaslaması (`[MOCK→radar]`).

---

## Faz 2 — Yüksek öncelik (günlük kullanım)

### 2.1 Management Response Analytics
- **Yeni bölüm/lens:** `/os` içinde "Yanıt Yönetimi" kartı **veya** ayrı `/os/responses`.
- **İçerik:**
  - Platforma göre cevap oranı (Google %87, TA %61…) — yatay bar.
  - Sentiment'a göre cevap oranı (poz/neg/nötr ayrı).
  - Rakip ortalamasına karşı (`getCompetitorScores` response alanı varsa canlı, yoksa `[MOCK→radar]`).
  - Medyan yanıt süresi (mevcut `responseStats` genişlet).
- **Veri:** Cevap oranı KPI'sı zaten var (os.ts `MOCK_OS_KPIS.responseRate`); breakdown `[MOCK→radar]`.

### 2.2 Trend grafiğini platform lens'ine de ekle
- `TrendChart` /os ve /os/department'ta var; **/os/platform'da YOK**.
- Platform hero altına GPI/sentiment time-series ekle (`[MOCK→radar]`).

### 2.3 Semantic Mentions Explorer (cümle-düzeyi)
- Mevcut `MentionList` = kategori×subcategory özet. ReviewPro = cümle-düzeyi.
- **Yeni:** `MentionExplorer` component — her mention'ı ayrı satır, excerpt içinde
  anahtar kelime **highlight** (poz=yeşil/neg=kırmızı).
- **Yer:** /os/platform ve /os/department "Yorumlar/Mentions" sekmesi.
- **Veri:** review excerpt'leri canlı; cümle-segmentasyon + highlight `[MOCK→radar]` (ABSA span'leri backend'den gelene kadar basit kelime-eşleme).

### 2.4 Results breakdown (dil / seyahat tipi)
- **Dil bazlı:** /os/platform veya /os'ta dil dağılımı kartı (reviews `language` alanı CANLI).
- **Seyahat tipi:** `travelType` alanı CANLI (detail modal'da var) → /os'ta Family/Couple/Group segmentasyon kartı + filtre.
- **Ülke/platform-ranking:** backend'de YOK → **şimdilik atla** (faking yerine omit — mevcut karar).

---

## Faz 3 — Orta öncelik

### 3.1 Hedef oluşturma UI (Goals)
- `GoalProgress` gösterim var; **oluşturma/düzenleme YOK**.
- **Yeni:** Departman lens'inde "Hedef ekle" → GPI/aspect hedefi + son tarih formu.
- **Veri yazma:** `createGoal` tool'u (ECHO_OS_PLAN'da radar'a tanımlı) — şimdilik local state, sonra radar.
- `osState.canSetGoals` zaten var (department lens) — buna bağla.

### 3.2 Top Concept Trends
- **Yeni:** "Yükselen/Düşen kavramlar" kartı (ör. "müzik" +0.8, "çalışanlar" −0.6).
- **Veri:** backend `concept_key` field var ama trend YOK → `[MOCK→radar]`.
- **Yer:** /os Genel lens.

### 3.3 Alert oluşturma UI + Rail counter aksiyonu
- Settings'te Hoops trigger + anomali kuralları VAR. Eksik: **kullanıcının kendi
  ad-hoc alert kuralını** /os içinden kurması + Rail'deki "açık uyarı" Bell
  counter'ına **tıklanınca** alert listesi drawer'ı (şu an onclick boş).

---

## Faz 4 — Düşük öncelik (ileri aşama)
- Response Templates (hazır şablon yanıtlar) — Phase 2 response-drafting ile (LAD-5).
- Trip Type segmentasyon analitiği (2.4'ün derinleşmesi).
- Internal Ranking (zincir içi sıralama) — `/portfolio` navda var, route yok.
- "Sayfam" / özel dashboard builder.

---

## Build sırası (öneri)
1. **Faz 1** (kırık linkler) — küçük, riski düşük, navigasyonu sağlamlaştırır. **İlk PR.**
2. **Faz 2.1 + 2.2** (response analytics + platform trend) — en görünür günlük değer.
3. **Faz 2.3 + 2.4** (mentions explorer + breakdown'lar).
4. **Faz 3**, sonra **Faz 4**.

## Riskler / notlar
- Çoğu yeni veri `[MOCK→radar]` — backend (radar) endpoint'leri henüz yok; UI
  mock şekille kurulur, sözleşme `ECHO_OS_DATA.md`'ye eklenir.
- `(app)/benchmark` mantığı `/os/competitors`'a taşınırken **kopya değil yeniden
  kullanım** hedeflenmeli (ortak component'ler `lib/components`'e).
- Platform-native rating/ranking ve ülke segmentasyonu backend'de YOK → bu plan
  bunları **kapsam dışı** bırakır (faking yok — mevcut proje kuralı).
