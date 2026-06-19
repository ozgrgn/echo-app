# ECHO OS — Veri Envanteri (B0)

> Her ekran bloğu için: hangi alan bugün GERÇEK (echo-backend/echo-ui mock'ta tip
> olarak var), hangisi EKSİK (radar/yeni iş). Mock üretirken bunu rehber al —
> boşa mock yazma. Sahiplik: radar §6.0 (echo=GPI/review authoritative,
> radar=snapshot/zekâ, ops-engine=departman, talkwo-api=venue).

İşaretler: `[REAL]` tip mevcut · `[MOCK→radar]` eksik, radar üretecek ·
`[MOCK→echo]` eksik, echo-backend üretecek · `[MOCK→ops]` ops-engine'den gelecek.

## Genel lens (`/os`)

### Üst KPI şeridi (5 kart)
| KPI | Alan | Durum | Not |
|---|---|---|---|
| Genel GPI | `HotelScore.gpi` | `[REAL]` | mock'ta 81.7 (Lago) |
| GPI delta (▼1.2) | — | `[MOCK→radar]` | önceki snapshot farkı; radar serisi |
| GPI sparkline | — | `[MOCK→radar]` | zaman-serisi yok (radar `DailySnapshot`) |
| RPI | `HotelScore.rpi` | `[REAL]` | mock 103.2 |
| Toplam Yorum | `HotelScore.reviewCount` | `[REAL]` | mock 847 |
| Yorum delta (%18↓) | — | `[MOCK→radar]` | önceki dönem farkı |
| Yanıt Oranı | `responseStats.rate` | `[REAL]` | mock 0.38 |
| Yanıt delta | `responseStats.rateTrend` | `[REAL]` | mock -2.5 |
| Rakip Farkı | `gpi - rpi` türev | `[REAL]` | hesaplanabilir |

### GPI trend grafiği (area + hedef çizgisi + projeksiyon)
| Öğe | Durum | Not |
|---|---|---|
| Gerçekleşen seri | `[MOCK→radar]` | zaman-serisi |
| Hedef çizgisi (75) | `[MOCK→echo]` | hedef TANIMI echo'da; yok henüz |
| Projeksiyon (kesikli) | `[MOCK→radar]` | radar zekâsı (gidişat) |

### Platformlar listesi (tıkla→evren)
| Alan | Durum | Not |
|---|---|---|
| platform adı/skor (TA 4.48, Booking 8.1…) | `[MOCK→echo]` | per-platform skor; HotelScore tek-blend, platform kırılımı YOK |
| platform delta (↑0.2) | `[MOCK→radar]` | zaman-serisi |
| yorum sayısı/platform | `[MOCK→echo]` | platform kırılımı gerek |

### Kategori hareketi (bar liste)
| Alan | Durum | Not |
|---|---|---|
| kategori + skor | `HotelScore.categoryScores[].headlineScore` | `[REAL]` |
| kategori trend (▲▼) | `categoryScores[].trend` | `[REAL]` |

### Sorunlar / Övgüler
| Alan | Durum | Not |
|---|---|---|
| top issues/praises + örnek + sayı | `categoryScores[].topIssues/topPraises` | `[REAL]` |

### Departmanlar grid (tıkla→departman)
| Alan | Durum | Not |
|---|---|---|
| departman listesi (HK/MNT/F&B…) | `[MOCK→ops]` | ops `/config/departments` |
| departman skoru | `[MOCK→echo]` | departman→kategori haritası YOK → türetilemez henüz |
| departman trend | `[MOCK→radar]` | |

### Asistan paneli (sağ)
| Öğe | Durum | Not |
|---|---|---|
| scope rozeti, thread'ler, brief, stream | `[MOCK→radar]` | radar federe beyin; A1'de bağlanır |

## Özet — Genel lens'i mock'la kurmak için
- **Hazır gerçek:** gpi, rpi, reviewCount, responseStats, categoryScores
  (skor/trend/issues/praises) → `MOCK_HOTEL_SCORE` (echo-ui) yeterli.
- **Mock uydurulacak (işaretli):** tüm zaman-serileri (sparkline/trend/projeksiyon),
  platform kırılımı, departman skorları, asistan içeriği.
- **B1'de:** gerçek alanları `MOCK_HOTEL_SCORE`'dan besle; eksikleri açık tipli
  ayrı mock modülünde (`lib/mock/os.ts`) `[MOCK→...]` etiketiyle tut.
