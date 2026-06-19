# ECHO OS — Ürün & Uygulama Planı

> Kaynak: `talkwo-echo-app.html` (bağlı prototip) + `talkwo-echo-assistant-claude.html`
> (asistan konu-thread modeli). Bu plan o iki prototipi gerçek echo-panel'e
> (SvelteKit 5 + Tailwind 4) taşımanın yol haritasıdır.

## Kararlar (onaylandı)

### Frontend
- **Layout:** Yeni 3-sütunlu kabuk, **paralel rota `/os`** — eski `(app)/dashboard`
  vb. dokunulmaz, hazır olunca geçilir. (Eski dashboard'a eklenen yarım StatTile
  değişikliği **geri alındı**.)
- **Veri:** Önce **mock** — ama tiplenmiş ve **gerçek veri şekline birebir uyan**
  (Lago Hotel canlı verisinden türetilmiş). Her görünüm için "bu alan backend'de
  var mı?" envanteri çıkar (bkz. B0).
- **Component yeri:** `apps/echo-panel/src/lib/components`.
- **Tasarım:** Prototipi temel al, **bir üst seviyeye rafine et** (tipografi,
  elevation, uyarı hiyerarşisi). Token + Card/StatTile/DeltaBadge/Sparkline +
  elevation skalası **başlandı** (app.css + lib/components).

### Asistan (mimari) — RADAR FEDERE BEYİN
> ÖNEMLİ HİZALAMA: `talkwo-radar/backend/docs/radar-vision-and-demo-plan.md`
> okundu. Radar = "Talkwo OS"in motoru. **Ayrı asistan servisi KURMUYORUZ —
> asistan = radar.** Aşağısı bu dökümanla hizalı.

- **Tek beyin, çok lens.** Her sayfa ayrı asistan DEĞİL — aynı asistan, lense göre
  farklı **bağlam paketi + sistem talimatı + tool yetkisi**. Lens = bağlam merceği.
- **Federe LLM (radar §1.5):** LLM mekaniği (döngü, tool-calling, retry, token)
  **radar `core/llm/`'de** (`gmAssistant.openai.js` oraya terfi). Chunksuz, raw
  fetch, OpenAI gpt-4o. **Tool TANIMLARI her domain'in kendi backend'inde.**
  echo-backend kendi tool kataloğunu radar'a bildirir; radar tool seçince
  echo-backend'e **HTTP ile geri çağırır** (kullanıcının staff token'ıyla). DB'ler
  ayrı kalır, senkron/bayatlama yok.
- **echo-backend LLM ÇAĞIRMAZ** (CLAUDE.md kuralı korunur). Sadece **tool sağlar**:
  - UI tool'ları: explainScreen, applyFilter, highlightComponent, grafik-tetikle
    (UI-action → SSE ile frontend'e sinyal, BE'ye gitmez).
  - Veri/yazma: createGoal (hedef **tanımı** — GPI/aspect dili), GPI/kategori okuma.
- **Hesaplar radar'da** (radar §1.6 "hedef ZEKÂSI radar'da"): kaldıraç tahmini,
  projeksiyon, feasibility, anomali tespiti. echo-backend bunları çağırır/gösterir
  ama üretmez.
- **Hedef ikiye bölünür (radar §1.6):** TANIM domain'de (echo-backend, GPI/aspect),
  ZEKÂ radar'da (`GoalIntelligence`: feasibility/subGoals/projeksiyon). Radar
  hedefin sahibi değil ama her noktada zekâsı (konmadan önce danışman, sonra takipçi).
- **Snapshot/zaman-serisi tek merkez: radar** (`DailySnapshot`). Sparkline/trend/
  projeksiyon radar'dan. echo-backend `score_snapshots`'ını tutmaya devam eder;
  radar onu da okur/toplar.
- **"Sayı uydurma" kuralı** radar sistem promptunda zaten var — her rakam tool'dan.
- **Okuma her yerde, yazma tek yerde.** Platform/rakip lensleri read-only (teşhis;
  hedef koymaz → ilgili departmana yönlendirir). Departman lensleri yazma yetkili.
- **Thread modeli = sahiplik-merkezli (A).** Her konunun tek birincil departman
  sahibi var; hedef o departmana yazılır. ("B" reddedildi.)
- **Thread kalıcılığı:** AÇIK KONU — radar'da `WaConversation` var (WhatsApp);
  panel thread'i (closed-loop alert→aksiyon→follow-up) radar'da mı echo-backend'de
  mi? Netleşmedi.

### Asistan-frontend sözleşmesi (UI-action tool'ları)
- **3 tool sınıfı:** DATA (radar→echo-backend fetch, staff token) · UI-action
  (radar→frontend SSE komutu, BE'ye gitmez) · WRITE (createGoal, dept lensi).
- **applyFilter = UI-action.** highlightComponent de UI-action: LLM **semantik
  component ismi** (örn. `gpi-goal-table`) + **efekt** (`spotlight`/`dim`/`pulse`/
  `scrollTo`/`expand`) seçer; frontend semantik ismi gerçek DOM'a çözer (LLM
  kırılgan ID/selector uydurmaz).
- **Frontend her `ask`'te ekran snapshot'ı yollar:** aktif lens + görünen
  component kataloğu (LLM neyi hedefleyebileceğini bilir, uydurmaz) + hangi sayfa.
- **HTTP = SSE** (event'ler: `token` / `tool_start` / `ui_action` / `done`).
- **Auth:** frontend staff JWT taşır; radar DATA tool çağrılarında echo-backend'e
  aynen iletir (yetki/scope kullanıcıda).

### UI yerleşimi (hedef + uyarı)
- **Hedefler:** Canvas'ta görsel progress kartı (o lensin hedefleri) **+** asistan
  thread'inde takip. Durum canvas'ta, konuşma asistanda.
- **Uyarılar (radar/anomali):** Asistan stream'inde (radar konuşur) **+** rail'de
  global "açık uyarı" sayacı.
- **Rail global sayaçlar:** "risk altındaki hedef" + "açık uyarı" — her sayfadan
  erişilir, tıkla→ilgili lens. (Konu dağılmasına karşı merkez.)

### Departmanlar (ops-engine entegrasyonu)
- **Kaynak:** ops-engine `GET /config/departments` (venue-scoped). 12 kanonik:
  `hk, mnt, gr, fo, fnb, kitchen, spa, sec, con, pnb, anm, it` (tr/en label).
- **Auth:** servis-servis HS256, `OPS_ENGINE_INGEST_SECRET` (echo-backend'in
  `REVIEW_BACKEND_INGEST_SECRET` deseniyle aynı).
- **Departman lensleri:** sadece venue'de **review verisi olan** departmanlar açılır
  (boş lens yok).
- **Sorumluluk haritası YENİ:** ECHO 14-kategori/alt-başlık → ops-departman eşlemesi
  hiçbir yerde yok. **Default + venue override** koleksiyonu (ops'un departman
  override deseni gibi). "Klima = MNT mi yönetim mi?" gibi muğlaklıklar venue
  override ile çözülür. v1: her alt-başlığın **tek birincil departmanı**.

## Hedef mimari (prototipten)
```
┌──────┬─────────────────────────────┬──────────────────┐
│ rail │ canvas (lens'li çok-görünüm)│ asistan (kalıcı) │
│ 58px │ Genel / Platform / Departman│ 384px            │
└──────┴─────────────────────────────┴──────────────────┘
        ▲ paylaşılan state store ▲ — asistan canvas'ı sürer, canvas asistanı besler
```
Kritik mimari ilke: **asistan ve canvas çift yönlü bağlı.** Prototipte
`renderAssist(mode)` + `data-enter` bunu yapıyor. Bunu bir Svelte store
(`osState`: aktif lens, seçili platform/departman, filtreler, seçili thread)
ile kuracağız; iki sütun da bu store'u okur/yazar.

---

## Veri sahipliği — radar §6.0 OTORİTE
Radar dökümanı (`talkwo-radar/backend/docs/radar-vision-and-demo-plan.md` §6.0)
veri sahipliğini belirler:
- **Talkwo-OS verinin sahibi değil, referans tutucusu** (kademeli merkezleşme).
- Venue → talkwo-api · User/rol/departman → ops-engine/hoops · GPI/review →
  echo-backend (authoritative) · snapshot/zekâ → radar.
- Başka serviste tutulan veri = **shadow copy** (`sourceRef{system,externalId}` +
  `syncedAt` + `stale`). Tek yazar (sahip), diğerleri salt-okunur cache.
- Zaman-serisi = türev/özet (kopya değil): radar sahibin verisinden ihtiyacı olan
  sayıyı çıkarıp `DailySnapshot`'a biriktirir; bozulursa kaynaktan yeniden üretir.
- Geçiş: önce referans dışarıda, zamanla veri merkeze kayar — şema değişmez.

## İki iş kolu, dörder faz — sıra: B0 → B1 → (A1 ∥ B2) → A2

### B0 — Veri sözleşmesi envanteri (ön-adım, "verileri görelim")
Mock üretmeden önce her ekran-bloğu için neyin **gerçek**, neyin **eksik**
olduğunu tablolaştır. Çıktı: `ECHO_OS_DATA.md`.

- **Bugün backend'de VAR:** `HotelScore` (gpi, rpi, reviewCount, categoryScores,
  responseStats, avgStarRating), `CompetitorScore`, kategori `trend`/`topIssues`/
  `topPraises`, ham review örnekleri (Lago Hotel — canlı veriden çekildi).
- **Bugün YOK (mock'ta hayali, sonra backend işi):**
  - Zaman-serisi (KPI sparkline, GPI trend, projeksiyon) — snapshot var, seri
    servis edilmiyor → ileride `GET /scores/{slug}/series`.
  - **Hedefler** (goal: start/current/target/due/status) — şema yok.
  - **Departman → kategori haritası** (HK = ROOM+POOL+FACILITY) — yok.
  - **Kaldıraç tahmini** ("şunu düzelt → +3.1 GPI") — hesap motoru yok.
  - **Radar/anomali** (eşik/trend kırılması tespiti) — yok.
  - Platform dağılımı (5-kova yıldız dağılımı), bölge sıralaması (#12/89).
- Çıktıda her mock alanı `[REAL]` / `[MOCK-ileride-backend]` etiketlenir.

### Lens / LLM bağlam haritası (her satır = ayrı sistem-talimatı + bağlam + yetki)
Tek beyin, lense göre donanım değişir. **Okuma vs yazma** tek ayrım çizgisi.

| Lens (rota) | Kimlik | Bağlam paketi | Hedef yetkisi | Tool'lar |
|---|---|---|---|---|
| **Genel** `/os` | Sentez/baş editör | tüm lenslerin özeti + çapraz-bağ | okur → yönlendirir | explainScreen, scanAnomalies, applyFilter, crossInsight |
| **Platform** `/os/platform/[p]` (TA/Booking/Google/HC) | Platform uzmanı | sadece o platform verisi | okur → "F&B'de hedefe bağla?" yönlendirir | explainScreen, applyFilter(p), scanAnomalies(p), computeLeverage |
| **Rakipler** `/os/competitors` | Rekabet analisti | rakip skorları, RPI, kıyas | okur (hedef koymaz) | explainScreen, applyFilter, compareCompetitors |
| **Departman geneli** `/os/departments` | Operasyon sentez | tüm departman skorları | okur → yönlendirir | explainScreen, scanAnomalies, applyFilter |
| **Departman** `/os/department/[d]` | Departman uzmanı (tüm alt-başlıklarına hakim) | o departmanın sorumlu olduğu review alt-başlıkları | **YAZAR (createGoal)** | + createGoal, projectGoal, computeLeverage, assignTask |

- **Alt-başlık ayrı lens DEĞİL** — departman lensinin zoom'u (canvas filtreler,
  beyin/yetki aynı). Lens sayısı = platform sayısı + aktif departman sayısı + 2.
- **Departman lensleri** sadece venue'de review verisi olan departmanlar için açılır.

### B1 — İskelet & component envanteri
3-sütunlu kabuk + lens navigasyonu + paylaşılan store, mock veriyle çalışır.

**Rotalar (yeni `/os` grubu):**
- `/os` (Genel) · `/os/platform/[platform]` · `/os/competitors` ·
  `/os/departments` · `/os/department/[dept]`
- `+layout.svelte`: rail (+ global hedef/uyarı sayaçları) + canvas slot + asistan.

**Paylaşılan store (`osState`) — UI + asistanın gözü:**
- UI state: aktif lens, seçili platform/departman/alt-başlık, filtreler, dönem,
  seçili thread.
- **Makine-okunur ekran snapshot'ı:** asistanın `explainScreen` tool'u bunu okur;
  `applyFilter` tool'u bunu yazar (çift yönlü bağ). Asistan canvas'ı sürer.

**Component haritası (her sayfada ne var → hangi component):**

| Görünüm | Blok | Component | Tür |
|---|---|---|---|
| Genel | 5 KPI | `StatTile` (✓ başlandı) + `Sparkline`(✓)+`DeltaBadge`(✓) | kart+grafik |
| Genel | GPI trend | `TrendChart` (area+hedef çizgisi+projeksiyon) | grafik |
| Genel | Platformlar | `PlatformRow` (tıkla→evren) | liste |
| Genel | Kategori hareketi | `CategoryBar` | bar-liste |
| Genel | Sorunlar/Övgüler | `MentionList` | liste |
| Genel | Departmanlar | `DeptCard` (tıkla→departman) | kart-grid |
| Platform | hero | `PlatformHero` | hero |
| Platform | alt-tab'lar | `SubTabs` | navigasyon |
| Platform | puan dağılımı | `Distribution` | bar-liste |
| Platform | önce neyi düzelt | `OpportunityList` | sıralı liste |
| Departman | hero | `DeptHero` | hero |
| Departman | aktif hedefler | `GoalProgress` (start→cur→target) | grafik-bar |
| Departman | alt-başlıklar | `SubcategoryGrid` | grid |
| Ortak | panel | `Card`(✓), `SectionCard` (başlıklı) | primitive |

**Chart yaklaşımı:** prototipteki gibi **saf SVG** (kütüphane yok) — `TrendChart`,
`Sparkline`, `Distribution`, `GoalProgress` hepsi inline SVG. Mevcut projenin
HTML/CSS-only viz çizgisine sadık.

**Mock altyapısı:** `lib/mock/os/*` — `HotelScore` tipine uyan, Lago Hotel gerçek
verisinden türetilmiş; eksik alanlar (seri/hedef/departman) için açık tipli yeni
mock şemaları (sonra backend bunları karşılayacak).

### A1 — Açıklayıcı asistan (read-only, **gerçek LLM**)
Asistan paneli + store'a bağlanır. **Gerçek OpenAI gpt-4o** baştan bağlı (radar
deseni). Yetenekler:
- **Scope rozeti** canvas lens'iyle senkron (kimlik lense göre değişir).
- **Konu-thread sekmeleri** (her issue bir thread, durum: kritik/izleniyor/iyi).
  Thread'ler echo-backend Mongo'dan; sahibi bir departman.
- **Bugünün özeti** brief'i + stream (aktif konular, çapraz-platform içgörü).
- **Ekranı anlatır + sorulara cevap** — `explainScreen` tool'u ekran snapshot'ını
  okur; sayısal cevaplar echo-backend tool'larından gelir (LLM uydurmaz).
- **Sol tarafın filtrelerini değiştirir** — `applyFilter` tool'u store'u sürer
  (lens/platform/kategori). Çift yönlü bağın kalbi.
- **Radar:** `scanAnomalies` tool'u → anomali/sapma/öneri kartları.
- Aksiyon chip'leri: "TripAdvisor'da aç", "31 şikâyeti gör", "Çözüldü".

**İlk tool-set (A1 kapsamı):** explainScreen, applyFilter, scanAnomalies,
computeLeverage, projectGoal (A1'de okuma; yazma=createGoal A2'de). + gerekirse
"dinamik KPI" tool'u (bkz. açık konu).

**Asistan servisi (yeni, ayrı):** radar `gmAssistant.*` yapısının kopyası —
%80 aynı. Eklenen: lens-bazlı prompt/tool kapsamı, UI-action dalı, SSE, staff-token
taşıma. Detay aşağıda.

#### LLM mimarisi (radar deseni + ECHO uyarlamaları)
Ref: `talkwo-radar/backend/src/modules/gm-assistant/` (service ~112, openai ~43,
tools data-driven). Chunksuz, SDK'sız, raw fetch. ECHO dosya iskeleti:
```
echo-assistant-service/src/
  llm/openai.js        ← radar openai.js ~birebir kopya (fetch+Bearer+timeout)
  agent/loop.js        ← radar service.js uyarlaması (MAX_STEPS döngü, SSE yield)
  agent/systemPrompt.js← LENS-BAZLI dinamik prompt
  tools/registry.js    ← tool tanımları (data-driven: {description,params,method})
  tools/invoke.js      ← echo-backend HTTP client (staff token taşır)
  lens/scope.js        ← hangi lenste hangi tool açık (read/write kuralı)
  threads/store.js     ← echo-backend'den thread çek/kaydet
  http/server.js       ← POST /assistant/ask (SSE)
```

**İki tool sınıfı (kritik ayrım):**
- **DATA tool'ları** → orchestrator echo-backend'e **kullanıcının staff JWT'siyle**
  fetch atar → `role:'tool'` geri besler → LLM yorumlar. (computeLeverage,
  scanAnomalies, projectGoal, createGoal, explainScreen-context)
- **UI-action tool'ları** → BE'ye GİTMEZ; SSE ile frontend'e "store'u değiştir"
  komutu yayınlar; LLM'e sadece "uygulandı" döner. (applyFilter, openLens)

**SSE event tipleri:** `token` (cevap metni), `tool_start` ("TA verisi çekiliyor"),
`ui_action` (frontend store komutu), `done`.

**System prompt lense göre dinamik:** `systemPrompt({lens, venueSlug,
screenSnapshot, writeAllowed})`. Platform lensi: "TA uzmanısın, sadece TA,
hedef koyamazsın→F&B'ye yönlendir". Dept lensi: "HK uzmanısın, createGoal açık".
Radar'ın "sayı uydurma" kuralı aynen girer.

**Auth:** frontend `POST /assistant/ask` → `Authorization: Bearer <staffJWT>`;
servis bu token'ı DATA tool çağrılarında echo-backend'e **aynen iletir**. Yetki/
scope kullanıcıda kalır (asistan kullanıcının göremediği venue'yu göremez).

**Token koruması:** radar'ın `packResult` (`_rowCount` + ilk N satır) — yorum
listeleri büyük olabilir.

### B2 — Tasarım dili & rafine (A1 ile paralel)
Tek bir görsel standart — asistan dahil. Az önce başlanan token/Card/StatTile işi
buraya akar.
- **Token rafine:** elevation skalası (✓ eklendi), tipografi ölçeği, platform/
  departman renk kodları token'a (`--color-ta`, `--color-dep`...).
- **Uyarı hiyerarşisi:** kritik/risk öğeleri görsel olarak öne (KPI'da kırmızı
  vurgu, "kritik" pill, hedef-risk rozeti).
- **Hiyerarşi:** birincil metrik (GPI) yüksek altitude; ikincil sakin.
- "Şık ama basit": tutarlı radius/spacing/gölge, gürültüsüz.

### A2 — Hedef & takip motoru (yazma + matematik, echo-backend)
- **Hedef şeması (Mongo):** `Goal { venueId, ownerDept, scope, metric, start,
  current, target, due, status, threadId }`. Sahibi her zaman bir departman.
- **createGoal tool'u** sadece departman lenslerinde açık (okuma/yazma kuralı).
- **Matematiksel formülasyon:** ilerleme `(cur-start)/(tgt-start)`, gidişat
  projeksiyonu, risk eşiği — hepsi echo-backend'de deterministik (LLM çağırır).
- **Kaldıraç motoru:** "şu alt-başlığı X'e çek → departman/GPI skoruna +Y" —
  mention ağırlıklı tahmin (echo-core scoring'e komşu yeni katman).
- **Departmana iletme:** hedef → departman lensine + (ileride) ops-engine task'a
  (`assignTask`, `OPS_ENGINE_INGEST_SECRET`).
- **Takip:** asistan thread'i hedefi izler (alert→aksiyon→follow-up; Mongo'da kalıcı).

### Backend işleri (B0'da [MOCK] işaretlenenlerin gerçeklenmesi)
echo-backend'de yeni:
1. **Seri endpoint:** `GET /scores/{slug}/series` (snapshot geçmişinden zaman-serisi).
2. **Departman köprüsü:** ops `/config/departments` proxy/cache + **sorumluluk
   haritası** koleksiyonu (default + venue override).
3. **Hesap tool endpoint'leri:** computeLeverage, projectGoal, scanAnomalies,
   explainScreen-context, (dinamik KPI?).
4. **Hedef CRUD + thread persistence** (asistan servisinin çektiği store).
5. **Asistan servisi** (ayrı): radar deseni orchestrator.

---

## Bu oturumda ilk somut adım
B0 (veri envanteri `ECHO_OS_DATA.md`) + B1'in **iskeleti**: `/os` layout (rail +
canvas + asistan boş kabuk) ve **Genel lens**'i mock veriyle ayağa kaldırmak —
mevcut `Card/StatTile/DeltaBadge/Sparkline` + yeni `TrendChart/PlatformRow/
CategoryBar/MentionList/DeptCard` ile. Sonra senin görüp yön vermen için durur.

## Çözülmüş LLM kararları
- **applyFilter = UI-action tool** (BE'ye gitmez, frontend'e SSE komutu).
- **HTTP arayüzü = SSE streaming** (token/tool_start/ui_action/done event'leri).
- **Tool auth = kullanıcının staff token'ı** (servis aynen iletir; yetki kullanıcıda).

## Açık konular (sonra netleşecek)
- **"Dinamik KPI" tool'u:** sabit havuzdan seçme mi (kolay) yoksa ad-hoc metrik
  tanımlayıp hesaplatma mı (BE'de kompozisyonel sorgu motoru, ağır)? — netleşmedi.
- **applyFilter kalıcılığı (UI davranışı):** asistan filtreyi kullanıcının manuelini
  ezerek mi, geçici "asistan görünümü" mü, yoksa onaya tabi mi uygular? (Tool'un UI-
  action olduğu kesin; uygulanış davranışı netleşmedi.)
- **Model seçimi:** gpt-4o kesin mi, yoksa tool-yoğun döngüde gpt-4o-mini/4.1 maliyet
  dengesi? — netleşmedi.

## Çözülmüş not
Eski `(app)/dashboard`'a eklenen yarım StatTile değişikliği **geri alındı**; eski
dashboard dokunulmamış. Yeni iş tamamen `/os` altında.
