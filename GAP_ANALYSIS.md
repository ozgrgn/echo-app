# ECHO vs ReviewPro — Gap Analysis & MVP Roadmap

**Tarih:** 2026-06-06
**Karşılaştırılan referans:** ReviewPro/Shiji (20 ekran görüntüsü, Akka Alinda Hotel demo verisi)
**Mevcut sistem:** echo-frontend monorepo (`apps/echo-panel` + `packages/echo-core` + `packages/echo-ui` + `packages/absa-service`)
**Önceliklendirme kriteri:** MVP / satılabilir ürün için kritik olan özellikler

---

## 1. Yönetici Özeti (TL;DR)

**Mevcut durum kısaca:** Domain modeli ve scoring motoru beklenenden çok daha olgun (review-core'da Bayesian smoothing + recency decay + soft attribution + category rank damping zaten var). ABSA contract'ı production-grade ve evals geçiyor (%96.8 category accuracy). Frontend tarafında **6 ekran** çalışıyor (Login, Dashboard, Reviews, Categories, Category Detail, Benchmark, Settings) — bunlar ReviewPro'nun çekirdek değerinin yaklaşık **%55-60'ını** karşılıyor.

**Gap'lerin yapısı:**

| Katman | Olgunluk | Notlar |
|--------|----------|--------|
| Data/Domain (`review-core`) | ~%75 | Tipler ve scoring fonksiyonları büyük oranda hazır. Eksik: User/RBAC, Goal/KPI, Alert workflow, Case management, custom dashboard config |
| ABSA (`absa-service`) | ~%65 | Contract komple, evals geçiyor. Eksik: batch/api/state implementasyonu (echo-frontend kopyasında scaffold; "gerçek" kopya başka dizinde) |
| Backend/API | ~%40 | review-ui'de `MOCK_CONFIG` 6 endpoint'ten 4'ünü hâlâ mock'luyor (scores, survey, feedback, tenant) |
| Frontend/UI | ~%30 | ReviewPro'da 20 mantıksal ekran var, bizde 6 var. MVP için kritik 4-5 ekran daha lazım. |

**Stratejik tespit:** ECHO'nın **scoring motoru ReviewPro'dan teknik olarak daha sofistike** (Bayesian smoothing, attribution damping). Gap, ağırlıklı olarak **UI yüzey alanı** ve **iş akışı katmanları**'nda — hesap motoru veya semantic anlayışta değil.

**MVP'ye giden en kısa yol:** Aşağıdaki **P0 (5 ekran/özellik)** tamamlanırsa satılabilir bir ürüne ulaşırsınız:
1. Management Response Inbox (yanıt yönetimi ekranı + iş akışı)
2. Alerts & Notifications Center (uyarı oluşturma + tetikleme)
3. Semantic Mentions Drill-down (anılma bazlı keşif)
4. Goals/Targets ekranı
5. Multi-period date picker + period-over-period karşılaştırma

---

## 2. ReviewPro Ekranları — 20 Ekran × ECHO Mapping Matrisi

Her ekran için: **ReviewPro'da ne var?** → **Bizde karşılığı var mı?** → **Eksik kısımlar** → **MVP önceliği**

### Önem Sınıflandırması (Priority)
- **P0 — MVP-kritik:** Bu olmadan ürün satılamaz / temel değer önerisi eksik kalır
- **P1 — Yüksek değer:** İlk müşterilerde "olsun" sorulacak, satışı kolaylaştırır
- **P2 — Diferansiyasyon / Enterprise:** Daha sonraki sürümlerde rekabetçi avantaj için
- **P3 — Düşük öncelik:** Admin/konfigürasyon, ileri sürüm

### Durum Sınıflandırması (Status)
- ✅ **Var** — Çalışıyor (mock veya gerçek)
- 🟡 **Kısmi** — Veri modeli var, UI yok / UI var, veri mock / yarım kalmış
- ❌ **Yok** — Tamamen eksik

---

### Ekran #1 — Create Alert (Yorum Uyarı Sihirbazı)
**ReviewPro'da:** 4-adımlı sihirbaz — view seç (All Reviews / negative Feedback), tetikleme şekli (her yeni yorumda / özet zamanlamalı), alıcılar (me/workgroup/specific users), uyarı adı.

**Bizde:** 🟡 **Kısmi**
- Settings → Notifications sekmesinde **Anomaly Alerts** zaten var (GPI Düşüşü, Negatif Yorum Sıçraması, RPI Düşüşü) — `apps/echo-panel/src/routes/(app)/settings/+page.svelte`
- Email/WhatsApp/in-app kanalları, recipients yönetimi, weekly/monthly digest var
- **Eksik:** Yorum-bazında trigger (her yeni yorumda / belirli kategoride / belirli sentiment'te). Şu an sadece **anomali bazlı** uyarılar var, **review-bazlı** uyarı yok.

**Eksik kısımlar:**
- "Bu kategoride yeni negatif yorum geldiğinde uyar" tipi review-level trigger
- Saved view tabanlı uyarı (örn. "negative Feedback view'ında yeni yorum")
- Schedule digest (sadece haftalık/aylık değil, custom)

**Önerilen iş:** Mevcut Notifications sekmesini **"Alerts" tab'ına genişlet** — review-trigger eklentisi ile. Yeni rota gerektirmez.

**Öncelik:** **P1** — Anomaly alerts zaten önemli kısmı karşılıyor; review-level trigger satışta sorulan ama "must-have" değil

---

### Ekran #2 — Reviews / Rekabet Dağılımı (Competitive Distribution)
**ReviewPro'da:** Rakip otellerle anılma volume (Pos.Vol/Neg.Vol), ranking, sentiment % karşılaştırması — zaman serisi çizgi grafiği + rakip tablo.

**Bizde:** ✅ **Var (kısmen genişletilmeli)**
- `apps/echo-panel/src/routes/(app)/benchmark/+page.svelte`: GPI bar chart + category heatmap var
- **Eksik:** Volume/sentiment % bazlı karşılaştırma (sadece GPI/RPI var), zaman serisi (sadece spot rakam)

**Eksik kısımlar:**
- Rakip bazında **mention volume** ve **sentiment %** gösteren tablo kolonları
- **Time-series line chart** (rakip vs bizim hotel, daily/weekly/monthly grouping)

**Öncelik:** **P1** — Benchmark zaten var, eksik kısımlar genişletme

---

### Ekran #3 — Diller / Countries / Trip Type kırılımı
**ReviewPro'da:** Dashboard altında dil, ülke, seyahat türü (Family/Couple/Group) bazlı segment tabloları.

**Bizde:** 🟡 **Kısmi**
- `review-core` tiplerinde `Review` üzerinde `language`, `travelType` alanları var
- ReviewDetailModal'da gösteriliyor
- **Eksik:** Aggregate dashboard widget'ları (dile/ülkeye/seyahat türüne göre breakdown)

**Eksik kısımlar:**
- Dashboard veya yeni bir "Demographics" sekmesinde dil/ülke/trip-type segmentation
- Ranking + trend (örn. "Rusça yorumlar %91.4 olumlu, geçen aya göre +22.7")

**Öncelik:** **P2** — Hoş ama satışta "must-have" değil

---

### Ekran #4 — Hedefler (Goals)
**ReviewPro'da:** GRI™ index hedefleme — Past Year karşılaştırması, current period, goal % (örn. 100%), Reviews/Surveys sekme.

**Bizde:** ❌ **Yok**
- `review-core/types.ts`'de **Goal/Target tipi yok**
- UI'da hedef belirleme ekranı yok
- Settings → Notifications altında "GPI Düşüşü uyarısı" eşik değeri var ama bu **hedef değil**, anomali eşiği

**Eksik kısımlar:**
- `Goal` tipi (categoryKey?, periodEnd, targetGpi, currentGpi)
- Settings'te veya yeni `/goals` rotasında hedef oluşturma/listeleme
- Dashboard'da "Goal achievement" widget'ı (yüzdelik ilerleme)
- Index seçimi (GRI/CQI), Department seçimi

**Öncelik:** **P0** — Otel müdürleri "hangi hedefe ne kadar yaklaştık?" görselini bekler; sözleşmede sıkça sorulan özellik

---

### Ekran #5 — Semantik / Anılmalar (Mentions Drill-down)
**ReviewPro'da:** Yorumlardan çıkarılan **kavram bazlı sentiment etiketleri** listesi — her satır bir cümle/snippet, vurgulanmış kelimeler (guest relations, отель, мини клуб, спорт-тренера), sentiment ikonu (😊/😞), tarih, kaynak. View filter ("All Mentions"), category filter, summary toggle.

**Bizde:** 🟡 **Kısmi**
- `SentimentItem` tipinde `excerpt`, `target_text` zaten var — **veri modeli hazır**
- ABSA çıktısı tam olarak bu görselleştirmeyi destekleyecek şekilde tasarlanmış (`absa-service/src/contract/schema.ts`)
- **Eksik:** UI komple yok. Sadece kategori detayında subcategory aggregate var.

**Eksik kısımlar:**
- Yeni rota: `/mentions` veya `/semantic`
- Mention list component (excerpt highlight + sentiment + meta)
- Concept/keyword filter (taxonomy → concept_key field henüz null, Phase 2)
- View saved filters (örn. "All Mentions", "Negative Feedback")

**Öncelik:** **P0** — ABSA'nın ana satış argümanı bu; yorumlar üzerinde "neye bakıyorsun?" sorusunun cevabı. Veri zaten orada, sadece UI yok.

---

### Ekran #6 — Mentions Summary (Toplam Anılma + Sentiment %)
**ReviewPro'da:** Üst KPI: Toplam anılma (2,091), Olumlu (%92.4), Negative (%7.6), Reviews & Responses (195). Altında Categories / Sources / Languages tabloları.

**Bizde:** 🟡 **Kısmi**
- Dashboard'da Review Count, GPI, RPI, Response Rate var
- **Mention bazlı toplam ve sentiment % yok** — şu an scoring review-level, mention-level summary yok

**Eksik kısımlar:**
- Dashboard'a "Total Mentions" KPI'si
- Mention-level sentiment dağılımı (positive/negative/neutral count)
- Categories tablosunda Mention/Pos.Vol/Neg.Vol kolonları (şu an sadece GPI var)

**Öncelik:** **P1** — Dashboard'ı zenginleştiren, satışta görsel etki yaratan widget'lar

---

### Ekran #7 — Mentions Detail (Categories / Sources / Languages / Countries)
**ReviewPro'da:** Mention sayısı + Pos.Vol/Neg.Vol/sentiment % ile detay tabloları.

**Bizde:** 🟡 **Kısmi**
- Categories sayfasında GPI ve trend var ama **mention volume / sentiment %** kolonları yok
- Settings'te sources listesi var ama analytics yok

**Eksik kısımlar:**
- Categories tablosuna mention count, pos.vol, neg.vol, neg.% kolonları
- Sources analytics ekranı (Google, Tripadvisor, vs. mention/sentiment)
- Languages analytics ekranı
- Countries analytics ekranı

**Öncelik:** **P1** — Genişletme işi, mevcut sayfaya kolon ekle

---

### Ekran #8 — Revenue Optimizer Dashboard (CQI™ vs RGI/ARI/MPI)
**ReviewPro'da:** STR Global verisiyle entegre — CQI™ Quadrant chart (Revenue Opportunity / Optimized / Problematic / Revenue Risk), RGI/ADR/MPI index'leri, Indexes Evolution çizgi grafiği.

**Bizde:** ❌ **Yok**
- STR entegrasyonu yok
- RGI/ADR/MPI hesaplaması veya tipi yok
- Quadrant visualization yok

**Eksik kısımlar:**
- Üçüncü taraf STR/benchmark veri entegrasyonu
- Yeni KPI'lar (RGI, ADR, MPI)
- Quadrant chart component

**Öncelik:** **P3** — Enterprise tier özelliği, STR datası lisanslı ve maliyetli. MVP'de gerekmez.

---

### Ekran #9 — Reviews Competition (GRI™ + CQI™ trendi)
**ReviewPro'da:** Rakip otellerin GRI ve CQI çizgi grafiği, her rakibin GRI/Reviews/CQI değerleri tablo halinde, Competition Average satırı.

**Bizde:** ✅ **Var (kısmen genişletilmeli)**
- Benchmark sayfasında competitive GPI bar chart var
- **Eksik:** Zaman serisi (line chart), CQI metriği

**Eksik kısımlar:**
- Time-series line chart (own + competitors GPI over time)
- "Competition Average" hesabı ve satırı
- Goal overlay (kendi hedefimiz çizgi grafiğin üzerinde)

**Öncelik:** **P1** — Benchmark sayfasını genişletme

---

### Ekran #10 — Departments / Sources / Languages / Countries kırılımlı GRI
**ReviewPro'da:** Departments (Room/Location/Service/Cleanliness vs.) bazında GRI sıralaması ve trend.

**Bizde:** ✅ **Var**
- Categories sayfası bunun karşılığı (kategoriler = departmanlar)
- Department metadata `review-core/categories.ts`'de `primaryOwner` field'ında var

**Eksik kısımlar:**
- "Ranking by departments" gösterimi (örn. "4/14 hotels", "2/14"). Bu rakip benchmark gerektirir.
- Sources, Languages, Countries için ayrı **GRI** sıralama (mention sıralaması kısmen var)

**Öncelik:** **P2** — Categories sayfası ana ihtiyacı karşılıyor

---

### Ekran #11 — Bölümler / Kaynaklar / Diller (Multi-tesis karşılaştırma)
**ReviewPro'da:** Multi-property kıyaslama — birden fazla otelin yan yana karşılaştırması.

**Bizde:** ❌ **Yok**
- Portfolio rotası planlanmış ama henüz yok (`navigation` menüde placeholder)
- `review-core/types.ts`'de `PortfolioScore` tipi var ama ekran yok
- Multi-venue switcher topbar'da placeholder

**Eksik kısımlar:**
- `/portfolio` rotası (PortfolioScore'u gösteren UI)
- Multi-property karşılaştırma tablosu
- Venue switcher UI implementasyonu

**Öncelik:** **P1 (zincir müşteri için P0)** — Akka Hotels gibi multi-property zincirler MVP müşterisi olacaksa P0; tek otel müşterisi için P2

---

### Ekran #12 — Reviews Management Response (Yanıt Yönetimi)
**ReviewPro'da:** %76 yanıt oranı, ortalama 1.7 gün, kaynak bazında yanıt dağılımı (Google %87.8, Tripadvisor %61.5), sentiment bazında (Positive/Neutral/Negative), management response goal (81%).

**Bizde:** 🟡 **Kısmi**
- `OwnerResponse` tipi var (`review-core/types.ts:184-189`)
- Dashboard'da Response Rate KPI'si var (response/awaiting linki ile)
- ReviewDetailModal'da yanıt görüntüleme var
- **Eksik:** Dedicated Response Management ekranı, yanıt yazma/düzenleme/AI taslak workflow'u

**Eksik kısımlar:**
- Yeni rota: `/responses` (response inbox)
- Filtreleme: yanıt verilmemiş / sentiment / kaynak / sürede
- Yanıt yazma componenti (rich text? template? AI draft?)
- Response goal/SLA tracking widget
- Source bazında ve sentiment bazında breakdown tablosu
- "Verified" badge / publish status (multi-source publishing)

**Öncelik:** **P0** — ReviewPro'nun **#1 değer önermesi yanıt yönetimi**. Bu olmadan ürün eksik kalır. Tipler hazır, sadece UI ve workflow yazılacak.

---

### Ekran #13 — Source Profile Information (Google/Tripadvisor/Booking puanları)
**ReviewPro'da:** Her kaynağın Source Score (4.7/5, 8.9/10), Ranking (2 of 53), Average Score, Reviews count gösterilir.

**Bizde:** 🟡 **Kısmi**
- `Review` üzerinde `source` field'ı var (platform)
- Settings'te platform subscription listesi var
- **Eksik:** Source-level skor toplama, ranking (third-party scraping/API gerektirir)

**Eksik kısımlar:**
- Source profile widget (her source için summary card)
- Source ranking verisi (örn. "2 of 53 hotels in area") — bu Google/Tripadvisor scraping veya API gerektirir

**Öncelik:** **P2** — Enterprise/kanıtlama amaçlı; MVP için zorunlu değil

---

### Ekran #14 — Languages / Countries Breakdown
**ReviewPro'da:** Dil ve ülke bazında GRI, Reviews, Mentions tabloları.

**Bizde:** 🟡 **Kısmi**
- Veri var, UI yok (yukarıda #7 ile aynı problem)

**Öncelik:** **P1** — #7 ile birlikte yapılır

---

### Ekran #15 — Semantik / Categories Negatively/Positively Affecting GRI
**ReviewPro'da:** Bir kategori GRI'yi ne kadar negatif/pozitif etkiledi? GRI Impact metriği, Top Concept (örn. "bina", "konuk", "meyve"). Top Concept Trends (Trending Up/Down).

**Bizde:** 🟡 **Kısmi**
- `review-core/scoring.ts`'de category-level scoring fonksiyonları var (impact hesaplama mümkün)
- **Eksik:** Bu metriklerin UI'a yansıması, concept_key kullanımı (henüz null), trend hesaplaması

**Eksik kısımlar:**
- Dashboard veya yeni `/insights` sayfasında "Categories Negatively/Positively Affecting GRI" widget
- Concept-level aggregation ve top concept extraction
- Trending Up/Down listesi
- Backend'de impact hesaplama endpoint'i

**Öncelik:** **P0** — Bu, müşteriye "neyi düzeltirsem GRI artar?" sorusunun cevabı. Müdür/sahip ekranında olması beklenir.

---

### Ekran #16 — Categories Negatively/Positively Affecting Competition GRI™
**ReviewPro'da:** Rakiplere etki eden negatif/pozitif kategoriler. Rakip kıyaslamasının semantic katmanı.

**Bizde:** ❌ **Yok**
- Rakip ABSA verisi yok (sadece rakip GPI/rating var, kategori detayı yok)

**Eksik kısımlar:**
- Rakip yorumları çekme + ABSA pipeline'dan geçirme
- Competitor-level category impact analysis

**Öncelik:** **P2** — Rakip yorumlarını semantic analyze etmek pahalı (LLM maliyeti) ve hukuki gri alan (ToS). Enterprise feature.

---

### Ekran #17 — Reviews List with Modal (Yorum listesi + detay)
**ReviewPro'da:** Yorum listesi, her satırda Respond / Mark As Responded / Create Case / Publish butonları. Modal'da full text, management response inline gösterimi.

**Bizde:** ✅ **Var (kısmen genişletilmeli)**
- `apps/echo-panel/src/routes/(app)/reviews/+page.svelte` + `ReviewDetailModal.svelte`
- Liste + filtre + modal var
- **Eksik:** Inline action butonları (Respond/Mark/Create Case/Publish)

**Eksik kısımlar:**
- Each review row'a action buttons
- "Create Case" → Case management feature (henüz yok)
- "Publish" → Multi-channel publishing (henüz yok)
- "Mark As Responded" → Manual override flag

**Öncelik:** **P0** (Respond + Mark As Responded), **P2** (Create Case, Publish) — Yanıt verme akışı satılabilir ürün için zorunlu

---

### Ekran #18 — Sayfam (Custom Dashboard Builder)
**ReviewPro'da:** Kullanıcı kendi widget'larını seçebileceği konfigüre edilebilir dashboard — Reviews KPI, Top Sources, Summary, Source Profile widget'larını ekleme/çıkarma/sıralama.

**Bizde:** ❌ **Yok**
- Dashboard sabit layout
- Widget seçme/sıralama mekanizması yok

**Eksik kısımlar:**
- Widget registry sistemi
- Drag-drop layout (grid-based)
- Page save/load (per-user veya per-tenant)
- "Sayfa Oluştur" butonu ve modal

**Öncelik:** **P3** — Enterprise/power-user özelliği. Çoğu kullanıcı default dashboard'la yetinir. İlk satışta zorunlu değil.

---

### Ekran #19 — Ayarlar (Hesap Yönetimi + Organizasyon)
**ReviewPro'da:**
- **Hesap Yönetimi:** Yanıt Taslakları, Semantik Kategoriler, Publish Reviews & Quality Seal, PMS & External IDs Mapping, Yorum Kaynağı Giriş Bilgisi, PII (anonim/sil)
- **Organizasyon:** İşletme Grupları, İşletmeler, Kısa İsimler, Departmanlar, Kullanıcılar, Çalışma Grupları, Rakipler

**Bizde:** 🟡 **Kısmi**
- Settings: Profile, Platforms, Competitors, Notifications sekmeleri var
- **Eksik:** Yanıt taslakları yönetimi, kullanıcı/role yönetimi (User/RBAC tipi tamamen eksik), departman yönetimi UI, semantik kategori admin

**Eksik kısımlar:**
- User management (CRUD + role assignment)
- Role-based access control (RBAC)
- Response template yönetimi
- Department CRUD (şu an `categories.ts`'de hardcoded `primaryOwner`)
- PMS integration mapping
- PII compliance ekranı (GDPR/KVKK için anonymize/delete)

**Öncelik:** **P0** (User/RBAC + Response Templates), **P1** (Department CRUD, PII), **P3** (PMS mapping, Quality Seal)
- User management olmadan multi-user tenant satılamaz

---

### Ekran #20 — Login (önceden ekranlar arasında yoktu ama context için)
**ReviewPro'da:** Standard login.

**Bizde:** ✅ **Var**
- `apps/echo-panel/src/routes/login/+page.svelte` — tenant key + secret + venue picker
- **Eksik (sadece kullanıcılar geldiğinde):** Username/password (şu an Client Credentials), SSO, password reset

**Öncelik:** **P0** kullanıcı bazlı login (User tipi ile birlikte)

---

## 3. Kategorize Edilmiş Gap Özeti

### 3.1 P0 — MVP-Kritik (5 Çekirdek İş)

| # | Özellik | Mevcut Durum | Gerekli İş | Tahmini Effort |
|---|---------|-------------|------------|----------------|
| 1 | **Management Response Inbox & Workflow** | OwnerResponse tipi var, Dashboard'da rate KPI var. UI yok. | `/responses` rotası + response composer + Mark/Respond actions + source breakdown + SLA tracking | M (1-2 hafta) |
| 2 | **Semantic Mentions Drill-down** | ABSA contract hazır, SentimentItem.excerpt var. UI yok. | `/mentions` rotası + mention list + filter + sentiment highlight | M (1-2 hafta) |
| 3 | **Categories Affecting GRI™ (Impact Analysis)** | Scoring fonksiyonları var, impact hesabı yok. | Backend endpoint + Dashboard widget veya `/insights` sayfası | S (3-5 gün) |
| 4 | **Goals/Targets** | Tip yok, UI yok. | `Goal` tipi + `/goals` rotası + Dashboard goal widget | S (3-5 gün) |
| 5 | **User Management + RBAC** | User/Role tipi yok, sadece tenant-level auth var. | User tipi + role enum + `/settings/users` sekmesi + permission checks | M (1-2 hafta) |

**Toplam P0 effort:** ~5-7 hafta tek geliştirici, ~3-4 hafta iki geliştirici paralel

### 3.2 P1 — Yüksek Değer (Satışı Kolaylaştıran)

| # | Özellik | Mevcut Durum |
|---|---------|-------------|
| 6 | **Period Selector + YoY Karşılaştırma** | Topbar placeholder var, samePeriodLastYearScore tipte var ama UI yok |
| 7 | **Mentions/Sentiment % Tabloları (Categories/Sources/Languages)** | Categories sayfası genişletme |
| 8 | **Review-Level Alert Triggers** | Settings'te anomaly alerts var, review-trigger eklentisi |
| 9 | **Competition Time-Series + Volume/Sentiment** | Benchmark sayfası genişletme |
| 10 | **Multi-Property/Portfolio Ekranı** | Tip var (`PortfolioScore`), UI yok. Zincir müşteride P0 |
| 11 | **Response Templates** | Settings altında templates yönetimi |
| 12 | **Department CRUD** | Hardcoded'tan dinamiğe geçiş |
| 13 | **Source-Level Insights (per-platform analytics)** | Sources sayfası |

### 3.3 P2 — Diferansiyasyon / Sonraki Sürüm

| # | Özellik |
|---|---------|
| 14 | Demographics breakdown (Trip Type, Country segmentation) |
| 15 | Source Profile / Ranking widget'ları |
| 16 | Rakip ABSA (competitor category impact) |
| 17 | PII compliance ekranı (GDPR/KVKK) |
| 18 | PMS integration mapping |

### 3.4 P3 — Düşük Öncelik / Enterprise

| # | Özellik |
|---|---------|
| 19 | Revenue Optimizer (STR/RGI/ADR/MPI integration) |
| 20 | Custom Dashboard Builder ("Sayfam") |
| 21 | Quality Seal / Embed widget |
| 22 | Survey Templates yönetimi (Mode B1 / hoops-panel'de) |

---

## 4. Kritik Olmayan ama Stratejik Tespitler

### 4.1 ECHO'nın Avantajları (Korumalı Olan)

ReviewPro'da görünür olarak **YAPILMAYAN** ama ECHO'da **olan** şeyler:
- **Bayesian smoothing** (`scoring.ts:382-384`) — Düşük mention'lı kategorilerde skor stabilizasyonu
- **Soft attribution** (`scoring.ts:208-250`) — Uzun yorumlarda kategori bazlı over-counting'i önler
- **Category rank damping** (`scoring.ts:267-295`) — 10 kategoriye değinen yorumun her birine eşit ağırlık vermez
- **Sofistike severity weighting** + critical flag routing (food_poisoning, theft, harassment → SECURITY)
- **LLM-native subcategory evolution** (novel keys allowed, validator warns değil reject etmiyor)

**Strateji:** Bunları satış materyalinde **"hesap motoru kalitesi"** olarak öne çıkarın. Ortalama hotel müdürü görmez ama danışman/agency müşterisi anlar.

### 4.2 ABSA-Service için Acil Aksiyon

`packages/absa-service/` echo-frontend kopyasında **kontrat hazır ama batch/api/state/prompt boş**. SESSION_HANDOFF.md'ye göre **"gerçek kopya" `~/projects/talkwo/reviews/absa-service`'te**. MVP'ye giderken:

- **Karar gerekiyor:** Tek kopyaya konsolide et mi, monorepo dışında bırak mı?
- **Kısa vadeli:** Production'da hangi kopya kullanılıyor netleştir
- **Önerim:** Tek kaynağı koru — kopya silsin veya birini canonical yap

### 4.3 review-ui Mock'lar Hâlâ Aktif

```typescript
// packages/echo-ui/src/index.ts MOCK_CONFIG
reviews: false      // REAL
venues: false       // REAL
scores: true        // MOCK ← MVP-blocker
survey: true        // MOCK
feedback: true      // MOCK
tenant: true        // MOCK ← MVP-blocker
```

**`scores` ve `tenant` hâlâ mock — bu, Dashboard/Categories/Benchmark ekranlarının üretimde çalışmadığı anlamına gelir.** MVP yolunda bu **#1 öncelikli backend işi**.

### 4.4 Mode A vs Mode B1 Karmaşıklığı

`echo-panel` Mode A'da standalone, Mode B1'de `talkwo-hoops-panel`'e embed oluyor. Survey ve Feedback ekranları **sadece Mode B1**'de var. MVP karar:
- **Satış senaryosu A:** Sadece ReviewPro alternatifi → Mode A yeterli, Survey/Feedback yok
- **Satış senaryosu B:** Talkwo Ops bundle'ın parçası → Mode B1 lazım, Survey/Feedback ekleyin

Bu, ürün stratejisi kararı. Teknik karar değil.

---

## 5. Önerilen MVP Roadmap (8-10 Hafta)

### Sprint 1-2 (Hafta 1-2): Backend Real Integration
- `MOCK_CONFIG.scores = false` yapacak backend endpoint'i (`GET /v1/venues/:slug/hotel-score`)
- `MOCK_CONFIG.tenant = false` yapacak subscription endpoint
- review-core'daki scoring fonksiyonlarını backend'de çalıştır
- **Çıktı:** Mevcut 6 ekranın gerçek veriyle çalışması

### Sprint 3-4 (Hafta 3-4): Management Response (P0 #1)
- `/responses` rotası
- Response composer (template + AI draft opsiyonu)
- Source/sentiment bazında inbox filtreleri
- Inline action buttons (Reviews listesinde)
- Response goal/SLA widget

### Sprint 5-6 (Hafta 5-6): Semantic Mentions + Impact Analysis (P0 #2, #3)
- `/mentions` rotası
- Mention list component (excerpt highlight + sentiment + meta)
- Dashboard'a "Categories Affecting GRI" widget
- Backend'de impact hesaplama endpoint'i

### Sprint 7 (Hafta 7): Goals + User Management (P0 #4, #5)
- Goal tipi + endpoint + `/goals` rotası
- User tipi + RBAC + `/settings/users`
- Dashboard goal widget

### Sprint 8 (Hafta 8): Period Selector + Polish
- Topbar period picker (current period + YoY)
- Dashboard'da YoY comparison
- Backend YoY query support

### Sprint 9-10 (Hafta 9-10): P1 Genişletmeler + QA
- Categories sayfası kolon genişletme (mention/pos.vol/neg.vol)
- Benchmark time-series
- Multi-property switcher (zincir müşteri varsa)
- E2E test + UAT

---

## 6. Açık Sorular / Karar Bekleyen

1. **User model:** Tenant-key auth devam edecek mi yoksa user-bazlı auth'a geçilecek mi? RBAC nasıl gözükecek?
2. **Multi-property önceliği:** İlk müşteriler zincir mi tek-otel mi? Bu Portfolio ekranının P0 mı P1 mı olduğunu belirler.
3. **AI yanıt taslağı:** Response Management'ta LLM-bazlı draft generation MVP'de mi yoksa Phase 2'de mi? `EchoSubscription.responseDraftsThisMonth` zaten quota track ediyor — yarı yolda.
4. **Survey/Feedback (Mode B1):** echo-panel MVP'sinde Survey ekranı olacak mı? Yoksa sadece hoops-panel'de mi kalacak?
5. **ABSA-service konsolidasyonu:** echo-frontend içindeki kopya mı, dışarıdaki mı canonical olacak?
6. **Hedef Pricing tier:** Bayesian smoothing/ABSA sofistikasyonu Pro tier'da mı vurgulanacak yoksa default mu olacak? Pazarlama tarafı.

---

## 7. Sonuç

ECHO, **scoring ve semantic anlayışta ReviewPro'dan teknik olarak ileri** durumda. Eksik olan **UI yüzey alanı ve workflow katmanları**. Bu, **mühendislik açısından düşük riskli** bir gap — yeni algoritma keşfetmek değil, mevcut motorun üstüne tutarlı ekranlar inşa etmek demek.

**8-10 haftalık P0 roadmap'i tamamlandığında**, ECHO satılabilir bir MVP olur — tek-otel ve küçük-zincir müşterilerine.

Bu noktadan sonra P1/P2 işleri **müşteri feedback'iyle önceliklendirilmeli** — şu an spekülatif öncelik vermek erken.

---

**Hazırlayan:** Claude (Opus 4.7, learning mode)
**Kaynaklar:** ReviewPro 20 ekran görseli + echo-panel route taraması + review-core type/scoring analizi + absa-service contract incelemesi
**Sonraki adım:** Bu rapora göre P0'lardan birini seç ve birlikte detaylı feature design yapalım
