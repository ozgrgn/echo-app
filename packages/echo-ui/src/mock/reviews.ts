import type { Review } from '@talkwo/echo-core';

// Phase 1 mock — 20 reviews covering 4 languages, realistic sentiment mix.
// v2.8: Aliases collapsed into canonical SUBCATEGORY_META keys.
// All keys here MUST match a canonical entry in @talkwo/echo-core/categories.

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev_001',
    platform: 'tripadvisor',
    publishedDate: '2025-05-12T00:00:00Z',
    rating: 4,
    title: 'Güzel tatil, bazı eksiklikler var',
    text: 'Kahvaltı çok güzeldi ve çeşit boldu. Oda temizdi ama ses izolasyonu yetersizdi. Personel güleryüzlüydü. Havuzda şezlong bulmak sabahları zordu.',
    lang: 'tr',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r001',
    sentiments: [
      { category: 'FOOD',  subcategory: 'breakfast',          sentiment: 'positive', polarity: +0.85, intensity: 0.9,  confidence: 0.94, excerpt: 'Kahvaltı çok güzeldi ve çeşit boldu' },
      { category: 'ROOM',  subcategory: 'room_cleanliness',           sentiment: 'positive', polarity: +0.75, intensity: 0.8,  confidence: 0.91, excerpt: 'Oda temizdi' },
      { category: 'ROOM',  subcategory: 'room_noise',                 sentiment: 'negative', polarity: -0.68, intensity: 0.7,  confidence: 0.88, excerpt: 'ses izolasyonu yetersizdi' },
      { category: 'STAFF', subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.78, intensity: 0.85, confidence: 0.93, excerpt: 'Personel güleryüzlüydü' },
      { category: 'POOL',  subcategory: 'sunbed_availability',        sentiment: 'negative', polarity: -0.70, intensity: 0.75, confidence: 0.90, excerpt: 'şezlong bulmak sabahları zordu' },
    ]
  },
  {
    id: 'rev_002',
    platform: 'tripadvisor',
    publishedDate: '2025-05-10T00:00:00Z',
    rating: 5,
    title: 'Excellent family holiday',
    text: 'We had an amazing time at this hotel. The mini club was fantastic for our kids. The beach is beautiful and clean. Food quality was top notch especially the dinner buffet.',
    lang: 'en',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r002',
    sentiments: [
      { category: 'KIDS',  subcategory: 'kids_club', sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.96, excerpt: 'mini club was fantastic for our kids' },
      { category: 'BEACH', subcategory: 'beach_cleanliness',    sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.93, excerpt: 'beach is beautiful and clean' },
      { category: 'FOOD',  subcategory: 'buffet',        sentiment: 'positive', polarity: +0.85, intensity: 0.88, confidence: 0.91, excerpt: 'dinner buffet top notch' },
    ],
    ownerResponse: {
      text: 'Thank you so much for your kind words! We are thrilled you enjoyed your stay and that your kids loved the mini club. We hope to welcome you back soon!',
      respondedAt: '2025-05-10T14:30:00Z',
      responseTimeHours: 14,
      language: 'en'
    }
  },
  {
    id: 'rev_003',
    platform: 'tripadvisor',
    publishedDate: '2025-05-08T00:00:00Z',
    rating: 3,
    title: 'Хорошо, но дорого',
    text: 'Отель хороший, но цены на дополнительные услуги очень высокие. Wi-Fi в номере слабый. Персонал вежливый, но не все говорят по-русски.',
    lang: 'ru',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r003',
    sentiments: [
      { category: 'VALUE', subcategory: 'extra_charges',          sentiment: 'negative', polarity: -0.78, intensity: 0.8,  confidence: 0.89, excerpt: 'цены на дополнительные услуги очень высокие' },
      { category: 'ROOM',  subcategory: 'room_wifi_internet',     sentiment: 'negative', polarity: -0.65, intensity: 0.7,  confidence: 0.87, excerpt: 'Wi-Fi в номере слабый', target_text: 'Wi-Fi' },
      { category: 'STAFF', subcategory: 'communication_language',  sentiment: 'negative', polarity: -0.55, intensity: 0.6,  confidence: 0.85, excerpt: 'не все говорят по-русски' },
    ]
  },
  {
    id: 'rev_004',
    platform: 'tripadvisor',
    publishedDate: '2025-05-06T00:00:00Z',
    rating: 5,
    title: 'Schöner Urlaub mit der Familie',
    text: 'Wir hatten einen wunderbaren Urlaub. Das Personal war sehr freundlich und hilfsbereit. Das Essen war ausgezeichnet, besonders das türkische Frühstück. Der Pool war sauber und groß genug.',
    lang: 'de',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.de/ShowUserReviews-g1192102-d545626-r004',
    sentiments: [
      { category: 'STAFF', subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.90, intensity: 0.92, confidence: 0.94, excerpt: 'Das Personal war sehr freundlich und hilfsbereit' },
      { category: 'FOOD',  subcategory: 'breakfast',           sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.92, excerpt: 'besonders das türkische Frühstück' },
      { category: 'POOL',  subcategory: 'pool_cleanliness',            sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.90, excerpt: 'Der Pool war sauber und groß genug' },
    ],
    ownerResponse: {
      text: 'Vielen Dank für Ihre wundervolle Bewertung! Es freut uns sehr, dass Ihre Familie eine schöne Zeit hatte.',
      respondedAt: '2025-05-07T09:15:00Z',
      responseTimeHours: 33,
      language: 'de'
    }
  },
  {
    id: 'rev_005',
    platform: 'tripadvisor',
    publishedDate: '2025-05-04T00:00:00Z',
    rating: 2,
    title: 'Beklentilerimizi karşılamadı',
    text: 'Otelin lokasyonu güzel ancak fiyatına göre yetersiz kaldı. Akşam yemeklerinde aynı yemekler tekrarlanıyordu. Resepsiyonda check-in için bir saatten fazla bekledik. Oda nemli ve klima düzgün çalışmıyordu.',
    lang: 'tr',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r005',
    sentiments: [
      { category: 'VALUE', subcategory: 'value_for_money', sentiment: 'negative', polarity: -0.80, intensity: 0.85, confidence: 0.90, excerpt: 'fiyatına göre yetersiz kaldı' },
      { category: 'FOOD',  subcategory: 'food_variety',  sentiment: 'negative', polarity: -0.65, intensity: 0.7,  confidence: 0.87, excerpt: 'aynı yemekler tekrarlanıyordu' },
      { category: 'FRONT', subcategory: 'check_in_out',   sentiment: 'negative', polarity: -0.88, intensity: 0.9,  confidence: 0.93, excerpt: 'check-in için bir saatten fazla bekledik' },
      { category: 'ROOM',  subcategory: 'air_conditioning',    sentiment: 'negative', polarity: -0.75, intensity: 0.8,  confidence: 0.89, excerpt: 'klima düzgün çalışmıyordu', target_text: 'klima' },
    ]
  },
  {
    id: 'rev_006',
    platform: 'tripadvisor',
    publishedDate: '2025-05-02T00:00:00Z',
    rating: 5,
    title: 'Perfect honeymoon destination',
    text: 'Spent our honeymoon here and it was perfect. The spa treatments were incredible. Sea view room was stunning. Staff went above and beyond to make our stay special.',
    lang: 'en',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r006',
    sentiments: [
      { category: 'SPA',   subcategory: 'massage_treatment',            sentiment: 'positive', polarity: +0.93, intensity: 0.95, confidence: 0.95, excerpt: 'spa treatments were incredible' },
      { category: 'ROOM',  subcategory: 'view_balcony_size',           sentiment: 'positive', polarity: +0.90, intensity: 0.9,  confidence: 0.93, excerpt: 'Sea view room was stunning' },
      { category: 'STAFF', subcategory: 'friendliness_helpfulness',  sentiment: 'positive', polarity: +0.90, intensity: 0.92, confidence: 0.94, excerpt: 'went above and beyond' },
    ]
  },
  {
    id: 'rev_007',
    platform: 'tripadvisor',
    publishedDate: '2025-04-29T00:00:00Z',
    rating: 4,
    title: 'İyi ama animasyon eksik',
    text: 'Genel olarak güzel bir tatil geçirdik. Yemekler lezzetli, personel ilgili. Ancak akşam aktiviteleri çok sınırlıydı, gece eğlenceleri tekrarlıydı.',
    lang: 'tr',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r007',
    sentiments: [
      { category: 'FOOD',          subcategory: 'food_quality_taste',        sentiment: 'positive', polarity: +0.72, intensity: 0.75, confidence: 0.88, excerpt: 'Yemekler lezzetli' },
      { category: 'STAFF',         subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.76, intensity: 0.8,  confidence: 0.89, excerpt: 'personel ilgili' },
      { category: 'ENTERTAINMENT', subcategory: 'night_shows',              sentiment: 'negative', polarity: -0.65, intensity: 0.7,  confidence: 0.86, excerpt: 'gece eğlenceleri tekrarlıydı' },
    ],
    ownerResponse: {
      text: 'Geri bildiriminiz için teşekkür ederiz. Animasyon programımızı çeşitlendirmek üzere ekibimizle birlikte çalışıyoruz.',
      respondedAt: '2025-05-02T11:00:00Z',
      responseTimeHours: 84,
      language: 'tr'
    }
  },
  {
    id: 'rev_008',
    platform: 'tripadvisor',
    publishedDate: '2025-04-27T00:00:00Z',
    rating: 1,
    title: 'Hiç tavsiye etmem',
    text: 'Web sitesinde gördüğümüz hiçbir şeyle uyuşmuyordu. Havuz suyu kirli, lobi havasız, asansörlerden ikisi bozuktu. Resepsiyon personeli yardımcı olmaktan kaçındı.',
    lang: 'tr',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r008',
    sentiments: [
      { category: 'POOL',     subcategory: 'pool_cleanliness',      sentiment: 'negative', polarity: -0.90, intensity: 0.95, confidence: 0.93, excerpt: 'Havuz suyu kirli' },
      { category: 'FACILITY', subcategory: 'elevators',              sentiment: 'negative', polarity: -0.85, intensity: 0.9,  confidence: 0.91, excerpt: 'asansörlerden ikisi bozuktu' },
      { category: 'FRONT',    subcategory: 'information_support',  sentiment: 'negative', polarity: -0.88, intensity: 0.95, confidence: 0.92, excerpt: 'Resepsiyon personeli yardımcı olmaktan kaçındı' },
    ]
  },
  {
    id: 'rev_009',
    platform: 'tripadvisor',
    publishedDate: '2025-04-25T00:00:00Z',
    rating: 5,
    title: 'Großartiges All-Inclusive!',
    text: 'Ein wirklich tolles Hotel. Das All-Inclusive-Konzept war umfassend und bot wirklich alles. Die Lage ist perfekt, direkt am Meer. Wir kommen wieder!',
    lang: 'de',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.de/ShowUserReviews-g1192102-d545626-r009',
    sentiments: [
      { category: 'VALUE',    subcategory: 'concept_inclusion',   sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.91, excerpt: 'All-Inclusive-Konzept war umfassend' },
      { category: 'LOCATION', subcategory: 'sea_access_quality',    sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.93, excerpt: 'Die Lage ist perfekt, direkt am Meer' },
      { category: 'GENERAL',  subcategory: 'loyalty_revisit', sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.90, excerpt: 'Wir kommen wieder!' },
    ]
  },
  {
    id: 'rev_010',
    platform: 'tripadvisor',
    publishedDate: '2025-04-22T00:00:00Z',
    rating: 4,
    title: 'Mostly great, some hiccups',
    text: 'Beautiful resort with great amenities. Pool area is huge with plenty of sun loungers. Breakfast buffet has excellent variety. Only issue was inconsistent WiFi in our room.',
    lang: 'en',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r010',
    sentiments: [
      { category: 'POOL', subcategory: 'sunbed_availability',    sentiment: 'positive', polarity: +0.85, intensity: 0.88, confidence: 0.90, excerpt: 'plenty of sun loungers' },
      { category: 'FOOD', subcategory: 'breakfast',      sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.89, excerpt: 'Breakfast buffet has excellent variety' },
      { category: 'ROOM', subcategory: 'room_wifi_internet',     sentiment: 'negative', polarity: -0.55, intensity: 0.6,  confidence: 0.85, excerpt: 'inconsistent WiFi in our room', target_text: 'WiFi' },
    ]
  },
  {
    id: 'rev_011',
    platform: 'tripadvisor',
    publishedDate: '2025-04-20T00:00:00Z',
    rating: 3,
    title: 'Karışık duygular',
    text: 'Bazı şeyler harika, bazıları hayal kırıklığı. Spa harikaydı. Ancak özel restoranlar rezervasyon almıyordu. Çamaşırlarımız 2 günde gelmedi.',
    lang: 'tr',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r011',
    sentiments: [
      { category: 'SPA',  subcategory: 'massage_treatment',      sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.92, excerpt: 'Spa harikaydı' },
      { category: 'FOOD', subcategory: 'a_la_carte',  sentiment: 'negative', polarity: -0.70, intensity: 0.75, confidence: 0.86, excerpt: 'özel restoranlar rezervasyon almıyordu' },
      { category: 'ROOM', subcategory: 'towel_linen',           sentiment: 'negative', polarity: -0.65, intensity: 0.7,  confidence: 0.85, excerpt: 'Çamaşırlarımız 2 günde gelmedi' },
    ]
  },
  {
    id: 'rev_012',
    platform: 'tripadvisor',
    publishedDate: '2025-04-18T00:00:00Z',
    rating: 5,
    title: 'Kids loved it!',
    text: 'Our 6-year-old had the best week of her life at the kids club. Animation team is incredibly engaged. Daytime activities were fun for all ages.',
    lang: 'en',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r012',
    sentiments: [
      { category: 'KIDS',          subcategory: 'kids_club', sentiment: 'positive', polarity: +0.96, intensity: 0.98, confidence: 0.97, excerpt: 'best week of her life at the kids club' },
      { category: 'ENTERTAINMENT', subcategory: 'day_activities',   sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.91, excerpt: 'Daytime activities were fun for all ages' },
    ],
    ownerResponse: {
      text: 'We are delighted your daughter enjoyed her time with us! Our animation team will be thrilled to hear this.',
      respondedAt: '2025-04-18T15:00:00Z',
      responseTimeHours: 6,
      language: 'en'
    }
  },
  {
    id: 'rev_013',
    platform: 'tripadvisor',
    publishedDate: '2025-04-15T00:00:00Z',
    rating: 4,
    title: 'Tertemiz tesis',
    text: 'Otelin geneli ve odalar tertemizdi. Kat görevlileri çok titiz. Konum biraz uzak, taksiye sıklıkla ihtiyaç oldu. Lobi modern ve geniş.',
    lang: 'tr',
    travelType: 'business',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r013',
    sentiments: [
      { category: 'ROOM',     subcategory: 'room_cleanliness',         sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.95, excerpt: 'odalar tertemizdi' },
      { category: 'STAFF',    subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.89, excerpt: 'Kat görevlileri çok titiz' },
      { category: 'LOCATION', subcategory: 'proximity_to_town',         sentiment: 'negative', polarity: -0.55, intensity: 0.6,  confidence: 0.84, excerpt: 'Konum biraz uzak' },
      { category: 'FACILITY', subcategory: 'common_area_cleanliness',   sentiment: 'positive', polarity: +0.78, intensity: 0.8,  confidence: 0.88, excerpt: 'Lobi modern ve geniş' },
    ]
  },
  {
    id: 'rev_014',
    platform: 'tripadvisor',
    publishedDate: '2025-04-13T00:00:00Z',
    rating: 2,
    title: 'Disappointed solo traveler',
    text: 'Felt out of place as a solo traveler. Most activities geared toward families. Restaurant staff slow during dinner rush. Beach was nice though.',
    lang: 'en',
    travelType: 'solo',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r014',
    sentiments: [
      { category: 'FOOD',    subcategory: 'fb_service',      sentiment: 'negative', polarity: -0.65, intensity: 0.7,  confidence: 0.86, excerpt: 'Restaurant staff slow during dinner rush' },
      { category: 'BEACH',   subcategory: 'sea_access_quality',    sentiment: 'positive', polarity: +0.72, intensity: 0.75, confidence: 0.87, excerpt: 'Beach was nice' },
      { category: 'GENERAL', subcategory: 'loyalty_revisit', sentiment: 'negative', polarity: -0.60, intensity: 0.65, confidence: 0.83, excerpt: 'Felt out of place as a solo traveler' },
    ]
  },
  {
    id: 'rev_015',
    platform: 'tripadvisor',
    publishedDate: '2025-04-11T00:00:00Z',
    rating: 5,
    title: 'Geniş aileyle keyifli bir tatil',
    text: '12 kişilik geniş ailemizle gittik. Her birimize ayrı ilgi gösterildi. Yemek seçenekleri herkesin damak tadına uygundu. Tekrar geleceğiz.',
    lang: 'tr',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r015',
    sentiments: [
      { category: 'STAFF',   subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.90, intensity: 0.92, confidence: 0.94, excerpt: 'Her birimize ayrı ilgi gösterildi' },
      { category: 'FOOD',    subcategory: 'food_variety',          sentiment: 'positive', polarity: +0.85, intensity: 0.88, confidence: 0.91, excerpt: 'Yemek seçenekleri herkesin damak tadına uygundu' },
      { category: 'GENERAL', subcategory: 'loyalty_revisit',      sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.95, excerpt: 'Tekrar geleceğiz' },
    ],
    ownerResponse: {
      text: 'Geniş ailenizi ağırlamak bizim için bir onurdu! Tekrar görüşmek üzere.',
      respondedAt: '2025-04-11T18:30:00Z',
      responseTimeHours: 2,
      language: 'tr'
    }
  },
  {
    id: 'rev_016',
    platform: 'tripadvisor',
    publishedDate: '2025-04-09T00:00:00Z',
    rating: 3,
    title: 'Sportlich aktiv, kulinarisch durchschnittlich',
    text: 'Das Fitnesscenter ist gut ausgestattet und der Pool für Bahnen perfekt. Das Essen war jedoch wiederholend und manchmal zu salzig. Schöne Anlage insgesamt.',
    lang: 'de',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.de/ShowUserReviews-g1192102-d545626-r016',
    sentiments: [
      { category: 'SPA',  subcategory: 'fitness',      sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.89, excerpt: 'Das Fitnesscenter ist gut ausgestattet' },
      { category: 'POOL', subcategory: 'pool_size_variety',   sentiment: 'positive', polarity: +0.78, intensity: 0.8,  confidence: 0.87, excerpt: 'der Pool für Bahnen perfekt' },
      { category: 'FOOD', subcategory: 'food_variety',  sentiment: 'negative', polarity: -0.62, intensity: 0.7,  confidence: 0.85, excerpt: 'Das Essen war jedoch wiederholend' },
    ]
  },
  {
    id: 'rev_017',
    platform: 'tripadvisor',
    publishedDate: '2025-04-07T00:00:00Z',
    rating: 4,
    title: 'Лучше чем ожидали',
    text: 'Очень понравилось обслуживание. Персонал решает любую проблему быстро. Бассейн чистый. Питание разнообразное.',
    lang: 'ru',
    travelType: 'family',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r017',
    sentiments: [
      { category: 'STAFF', subcategory: 'friendliness_helpfulness', sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.92, excerpt: 'Персонал решает любую проблему быстро' },
      { category: 'POOL',  subcategory: 'pool_cleanliness',           sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.89, excerpt: 'Бассейн чистый' },
      { category: 'FOOD',  subcategory: 'food_variety',         sentiment: 'positive', polarity: +0.78, intensity: 0.8,  confidence: 0.87, excerpt: 'Питание разнообразное' },
    ]
  },
  {
    id: 'rev_018',
    platform: 'tripadvisor',
    publishedDate: '2025-04-05T00:00:00Z',
    rating: 1,
    title: 'Para sayar gibi ekstralar',
    text: 'Her şey dahil paket aldık ama bir sürü ek ücret çıktı. Özel restoranlar için ekstra, A la carte için ekstra, masaj için ekstra... Anlamsızdı.',
    lang: 'tr',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r018',
    sentiments: [
      { category: 'VALUE', subcategory: 'extra_charges',        sentiment: 'negative', polarity: -0.92, intensity: 0.95, confidence: 0.94, excerpt: 'bir sürü ek ücret çıktı' },
      { category: 'VALUE', subcategory: 'concept_inclusion',  sentiment: 'negative', polarity: -0.82, intensity: 0.85, confidence: 0.90, excerpt: 'Her şey dahil paket aldık ama' },
    ]
  },
  {
    id: 'rev_019',
    platform: 'tripadvisor',
    publishedDate: '2025-04-03T00:00:00Z',
    rating: 5,
    title: 'Beautiful sea view!',
    text: 'Our room had the most stunning sea view. Breakfast on the terrace was magical. Will definitely recommend to friends.',
    lang: 'en',
    travelType: 'couples',
    sourceUrl: 'https://www.tripadvisor.com/ShowUserReviews-g1192102-d545626-r019',
    sentiments: [
      { category: 'ROOM',    subcategory: 'view_balcony_size',        sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.95, excerpt: 'most stunning sea view' },
      { category: 'FOOD',    subcategory: 'breakfast',         sentiment: 'positive', polarity: +0.88, intensity: 0.9,  confidence: 0.92, excerpt: 'Breakfast on the terrace was magical' },
      { category: 'GENERAL', subcategory: 'loyalty_revisit',    sentiment: 'positive', polarity: +0.90, intensity: 0.92, confidence: 0.93, excerpt: 'Will definitely recommend to friends' },
    ],
    ownerResponse: {
      text: 'Thank you for the lovely review! We are so glad you enjoyed the view.',
      respondedAt: '2025-04-04T16:00:00Z',
      responseTimeHours: 16,
      language: 'en'
    }
  },
  {
    id: 'rev_020',
    platform: 'tripadvisor',
    publishedDate: '2025-04-01T00:00:00Z',
    rating: 4,
    title: 'Resepsiyon süper hızlıydı',
    text: 'Check-in 5 dakikada bitti. Karşılama içeceği ve odaya bagaj eskortu güzel detaylardı. Otel temiz ve modern.',
    lang: 'tr',
    travelType: 'business',
    sourceUrl: 'https://www.tripadvisor.com.tr/ShowUserReviews-g1192102-d545626-r020',
    sentiments: [
      { category: 'FRONT',    subcategory: 'reception_service',         sentiment: 'positive', polarity: +0.92, intensity: 0.95, confidence: 0.95, excerpt: 'Check-in 5 dakikada bitti' },
      { category: 'FRONT',    subcategory: 'information_support',      sentiment: 'positive', polarity: +0.82, intensity: 0.85, confidence: 0.89, excerpt: 'Karşılama içeceği ve odaya bagaj eskortu' },
      { category: 'FACILITY', subcategory: 'common_area_cleanliness',    sentiment: 'positive', polarity: +0.80, intensity: 0.85, confidence: 0.88, excerpt: 'Otel temiz ve modern' },
    ]
  }
];
