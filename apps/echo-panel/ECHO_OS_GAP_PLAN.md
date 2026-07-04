# ECHO OS — ReviewPro Paritesi Gap Planı

> Hedef: ECHO OS (`(os)/*` lens sistemi) ile ReviewPro arasındaki feature
> boşluklarını kapatmak. **Hedef UI = `(os)` lens sistemi** (klasik `(app)/*`
> panel zamanla emekliye ayrılır). **Veri = mock-first**, `[MOCK→radar]`
> etiketiyle — backend hazır olunca bağlanır. Mevcut `ECHO_OS_PLAN.md`
> kararlarıyla hizalı.

> **GÜNCELLEME (2026-07-03):** OS beta artık **gerçek ürün yüzeyi** olarak
> onaylandı — eksik ReviewPro sayfaları OS lens'i olarak inşa edilir, (app)'e
> yeni sayfa açılmaz. Veri politikası da değişti (PROD_READY_PLAN §1):
> mock-first DEĞİL, **real-first** — backend endpoint'i yoksa uydurma yerine
> endpoint yazılır (backend oturumu erişilebilir); sentetik veri yalnız
> TEN_DEMO'da yaşar. `[MOCK→radar]` etiketli maddeler artık "backend işi aç"
> anlamına gelir. Güncel durum için en alttaki **Changelog**'a bak.

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

## Faz 1 — ✅ TAMAMLANDI (kod doğrulaması 2026-07-03)

Mevcut navigasyon kırık; yeni feature eklemeden önce iskeleti sağlamlaştır.

### 1.1 ✅ `/os/competitors` lens (Rakipler)
- **Yeni:** `routes/(os)/os/competitors/+page.svelte` + `+page.ts`
- **Veri:** `getCompetitorScores(venueSlug, period, token)` (CANLI) + blended GPI.
- **İçerik:**
  - GPI sıralaması (kendi otel vurgulu) — benchmark'taki bar mantığı, lens'e taşı.
  - Kategori heatmap (12 kategori × rakip) — `(app)/benchmark`'tan taşı/yeniden kullan.
  - **CQI (Competitive Quality Index)** kartı — `[MOCK→radar]` (rakip-ortalamasına göre normalize skor).
  - Departman/dil kırılımı — `[MOCK→radar]` placeholder, ileride.
- **Not:** `(app)/benchmark` mantığının çoğu yeniden kullanılabilir; kopyala-rafine et.

### 1.2 ✅ `/os/departments` lens — GERÇEK veriye bağlandı (2026-07-05, bkz changelog)
- **Veri artık GERÇEK:** `getDepartments()` → `/v1/departments/:slug` (kategori→departman
  rollup, ops-engine kanonik key'leri). `MOCK_OS_DEPTS` yalnız demo modunda.
- **İçerik:** `DeptCard` grid; tıkla → `/os/department/[dept]` (gerçek detay).

### 1.3 ✅ Platform alt-tab'larını işlevsel yap (genel/kategoriler/yorumlar/rakipler render ediliyor)
- **Dosya:** `routes/(os)/os/platform/[platform]/+page.svelte`
- Şu an `activeTab` sadece görsel. Her tab'a içerik bağla:
  - **Genel** (mevcut hero+dağılım+kategoriler) — varsayılan.
  - **Kategoriler** — tam kategori listesi (CategoryBar).
  - **Yorumlar** — o platformun yorumları (reviews API, platform filtresi).
  - **Rakipler** — o platformda rakip kıyaslaması (`[MOCK→radar]`).

---

## Faz 2 — Yüksek öncelik (günlük kullanım)

### 2.1 ✅ Management Response Analytics (2026-07-03 — platform lens'inde GERÇEK veri; pazar oranı hâlâ [MOCK→radar])
- **Yeni bölüm/lens:** `/os` içinde "Yanıt Yönetimi" kartı **veya** ayrı `/os/responses`.
- **İçerik:**
  - Platforma göre cevap oranı (Google %87, TA %61…) — yatay bar.
  - Sentiment'a göre cevap oranı (poz/neg/nötr ayrı).
  - Rakip ortalamasına karşı (`getCompetitorScores` response alanı varsa canlı, yoksa `[MOCK→radar]`).
  - Medyan yanıt süresi (mevcut `responseStats` genişlet).
- **Veri:** Cevap oranı KPI'sı zaten var (os.ts `MOCK_OS_KPIS.responseRate`); breakdown `[MOCK→radar]`.

### 2.2 ✅ Trend grafiğini platform lens'ine de ekle (TrendChart platform sayfasında)
- `TrendChart` /os ve /os/department'ta var; **/os/platform'da YOK**.
- Platform hero altına GPI/sentiment time-series ekle (`[MOCK→radar]`).

### 2.3 🟡 BÜYÜK ORANDA BİTTİ — Semantic Mentions Explorer (cümle-düzeyi)
> Durum 2026-07-03: `MentionExplorer.svelte` yazıldı, backend `/mentions`
> endpoint'i CANLI, platform sayfası "Yorumlar" tab'ında gerçek veriyle çalışıyor.
> Kalan: /os/department sayfasına da eklenmesi.
- Mevcut `MentionList` = kategori×subcategory özet. ReviewPro = cümle-düzeyi.
- **Yeni:** `MentionExplorer` component — her mention'ı ayrı satır, excerpt içinde
  anahtar kelime **highlight** (poz=yeşil/neg=kırmızı).
- **Yer:** /os/platform ve /os/department "Yorumlar/Mentions" sekmesi.
- **Veri:** review excerpt'leri canlı; cümle-segmentasyon + highlight `[MOCK→radar]` (ABSA span'leri backend'den gelene kadar basit kelime-eşleme).

### 2.3-ek ✅ Department lens'i GERÇEK veriye bağlandı (2026-07-05)
> Liste + detay lens'i artık `/v1/departments` rollup'ından besleniyor; department
> sayfasına MentionExplorer (kategori-filtreli /v1/mentions) eklendi. Detay.
> changelog'da. Goals + hedef alanları backend'de yok → sayfada BOŞ/"—" duruyor
> (çıkarılmadı), Faz 3.1 / 5.3 ile dolacak.

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

## Faz 5 — ReviewPro P0'ları (GAP_ANALYSIS.md'den, bu planda eksikti — eklendi 2026-07-03)

### 5.1 ✅ Yanıt Yönetimi INBOX'ı (2026-07-03 — platform lens TAB'ı olarak)
> KARAR (owner): ayrı `/os/responses` rotası DEĞİL, her platform sayfasına
> "Yanıtlar" alt-tab'ı. Venue-geneli toplu görünüm gerekirse ileride Genel
> lens'e özet kart eklenir. Detay aşağıda + Changelog'da.
- 2.1'deki analytics yalnız METRİK; ReviewPro'nun #1 değeri **inbox + workflow**:
  yanıtsız yorum listesi, sentiment/platform/yaş filtresi, yanıt görüntüleme.
- Veri HAZIR (backend `ownerResponse` dolu: TA 4.136, Google 1.057; read API
  `responseTimeHours` türetiyor). Yanıt OLUŞTURMA (compose/AI draft) sonraki faz.
- PROD_READY_PLAN B1 (modal'da yanıt gösterimi) bu işin alt kümesi.

### 5.2 ✅ GPI'yi etkileyen kategoriler (Impact Analysis) — YAPILDI (2026-07-05, changelog)
- "Neyi düzeltirsem GPI artar?" — kategori bazlı GPI-kaldıraç sıralaması.
  Backend counterfactual hesabı (gerçek scoring fn) + /os Genel lens'te widget.
  3.2 (Top Concept Trends) bunun kavram-düzeyi kardeşi — hâlâ açık.

### 5.3 Goals — backend gerçeklemesi
- 3.1 yalnız UI; `Goal` tipi + persist endpoint'i backend'de yok. OS beta
  gerçek ürün olacaksa hedefler local-state kalamaz.

### 5.4 Kullanıcı yönetimi + RBAC (OS kapsamı dışında ama satış ön koşulu)
- User tipi/login yok (tenant-key auth). Multi-user satış için gerekli;
  backend A9 RBAC işiyle birlikte tasarlanmalı. Ayrı tasarım oturumu ister.

---

## Build sırası (öneri — 2026-07-03 revize)
1. ~~Faz 1~~ ✅ bitti.
2. **Faz 5.1** (`/os/responses` inbox) — en büyük gap, verisi hazır, bağımsız.
3. **Faz 2.1** (response analytics — 5.1 ile aynı ekranda/yanında doğal).
4. **Faz 5.2** (impact widget) + 2.3 kalanı (department'a MentionExplorer).
5. **Faz 2.4** (dil/seyahat breakdown), **Faz 3**, sonra **Faz 4 / 5.3 / 5.4**.

## Riskler / notlar
- Çoğu yeni veri `[MOCK→radar]` — backend (radar) endpoint'leri henüz yok; UI
  mock şekille kurulur, sözleşme `ECHO_OS_DATA.md`'ye eklenir.
- `(app)/benchmark` mantığı `/os/competitors`'a taşınırken **kopya değil yeniden
  kullanım** hedeflenmeli (ortak component'ler `lib/components`'e).
- Platform-native rating/ranking ve ülke segmentasyonu backend'de YOK → bu plan
  bunları **kapsam dışı** bırakır (faking yok — mevcut proje kuralı).

---

## Changelog (yalnız YAPILMIŞ işler yazılır — niyet/"yapılıyor" işareti konmaz)

- **2026-07-03** — Kod doğrulama turu: Faz 1 (1.1/1.2/1.3) ✅, 2.2 ✅,
  2.3 büyük oranda ✅ (MentionExplorer + canlı /mentions endpoint'i; department
  sayfası kaldı). Plan OS-beta = gerçek ürün çerçevesine güncellendi; veri
  politikası mock-first → real-first; Faz 5 (ReviewPro P0'ları) eklendi.
- **2026-07-03** — **5.1 Yanıt Yönetimi inbox'ı + 2.1 analytics YAPILDI.**
  - Backend (echo-backend): `GET /v1/responses/stats` (oran, medyan süre,
    yanıtsız/negatif sayıları, sentiment×platform kırılımı — sentiment bucket'ı
    rating5 tabanlı) + `GET /v1/responses/queue` (öncelik-skorlu yanıtsız listesi;
    skor = olumsuzluk × tazelik(31 gün yarı-ömür) × metin-var; `reviews/responses.ts`,
    22 test `test:responses`, suite 139 ✅).
  - Frontend: platform sayfasına 5. alt-tab **"Yanıtlar"** — KPI şeridi (oran /
    medyan süre / yanıtsız / yanıtsız-negatif) + `ResponseInbox.svelte` (öncelik
    sıralı, satır-genişletme, "Platformda aç ve yanıtla" linki, öncelik/en-yeni
    toggle). Genel tab'daki ResponseAnalytics artık canlı `stats`'tan besleniyor
    (yalnız pazar oranı [MOCK→radar] kaldı). echo-ui: `getResponseStats/Queue`.
  - Canlı LAGO doğrulaması: rate %88 (TA %99.9, Google %60.1), medyan 312 saat,
    yanıtsız 706 (140 negatif). Google `respondedAt` vermiyor → süre metriği
    yalnız TA (UI "kaynak yanıt tarihi vermiyor" gösterir).
  - Kapsam: gösterim + triage. Compose/AI taslak sonraki faz (Faz 4 / LAD-5).
- **2026-07-05** — **Department lens'i GERÇEK veriye bağlandı (2.3-ek / 1.2).**
  - Backend (echo-backend): `GET /v1/departments/:slug` (rollup) +
    `/v1/departments/:slug/:deptKey` (detay). ECHO'nun 14 kategorisi
    **ops-engine kanonik departman key'lerine** (hk/fnb/fo/anm/mnt/spa/pnb/gr/sec)
    eşlendi — KARAR (owner): echo-local slug DEĞİL, ops key'leri (ileride Hoops
    task/personel join'i tutsun; eşleme tablosu echo'da, shared-nothing kopya).
    Skor = mention-ağırlıklı kategori ortalaması; mention'sız departman → null
    ("yetersiz veri"). Trend serisi geçmiş snapshot'lardan GERÇEK türetiliyor
    (yeterli geçmiş yoksa tek nokta). `scores/departments.ts`, 17 test
    `test:departments`, suite yeşil, typecheck temiz.
  - Frontend: `/os/departments` (liste) + `/os/department/[dept]` (detay) artık
    `getDepartments/getDepartmentDetail`'ten besleniyor; `MOCK_OS_DEPTS` yalnız
    demo modunda. Detaya kategori-filtreli MentionExplorer eklendi (2.3 tamam).
    Backend'de olmayan alanlar (Goals, Hedef/target) sayfadan ÇIKARILMADI —
    boş/"—" gösteriliyor, Faz 3.1/5.3 ile dolacak (owner kararı: hiçbir bölüm silme).
  - Canlı LAGO doğrulaması: 9 departman, en zayıf Ön Büro (fo) 66.0, en güçlü
    Güvenlik (sec) 78.4; key'ler ops-engine DEPT sabitleriyle birebir.
  - Sonraki: Faz 5.2 impact widget (bu oturumda alınıyor — plan'da işaretli).
- **2026-07-05** — **Faz 5.2 Impact Analysis YAPILDI ("neyi düzeltirsem GPI artar?").**
  - Backend (echo-backend): `GET /v1/insights/impact/:slug?target=85`. Her inGpi
    kategori için **counterfactual GPI kaldıracı**: o kategori hedefe çıkarsa GPI
    kaç puan artar — GERÇEK `computeOverallGpi` ile hesaplanır (uydurma katsayı
    YOK). aspectScore null olanlar `underMeasured`'a ayrılır (hayalet sıralanmaz).
    `scores/impact.ts`, 18 test `test:impact`, suite 183 ✅.
  - Frontend: `ImpactList.svelte` + Genel lens'te "Neyi düzeltirsem GPI artar?"
    kartı (kaldıraç sıralı, bar top-item'a göre ölçekli). echo-ui `getImpact`.
    Genel loader'a best-effort eklendi (hata → widget gizlenir); mock modda demo.
  - Canlı LAGO: GPI 66.2, en yüksek kaldıraç **Oda +3.6 GPI** (skor 41.5, 4057
    mention), ardından Resepsiyon/Personel +1.9. Gerçek "önce neyi düzelt" listesi.
