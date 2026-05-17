import type { Review } from '../types.js';

// Phase 1 mock per spec §7.3 — expanded to 20 reviews for visible
// dashboard demo. Covers:
//   - 4 languages: tr, en, de, ru
//   - 1 platform (tripadvisor — only one shipped; google/holidaycheck/check24
//     planned per API.md, see PLATFORM_REGISTRY)
//   - mix of sentiments + ratings + travel types
//   - many reviews include owner responses (response rate ~40%)
//   - all subcategory keys are from the consolidated taxonomy (categories.ts)
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
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.9, excerpt: 'Kahvaltı çok güzeldi ve çeşit boldu' },
			{ category: 'ROOM', subcategory: 'temizlik', sentiment: 'positive', intensity: 0.8, excerpt: 'Oda temizdi' },
			{ category: 'ROOM', subcategory: 'teknik_oda', sentiment: 'negative', intensity: 0.7, excerpt: 'ses izolasyonu yetersizdi' },
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.85, excerpt: 'Personel güleryüzlüydü' },
			{ category: 'POOL', subcategory: 'sezlong_alan', sentiment: 'negative', intensity: 0.75, excerpt: 'şezlong bulmak sabahları zordu' }
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
			{ category: 'ANIM', subcategory: 'cocuk', sentiment: 'positive', intensity: 0.95, excerpt: 'mini club was fantastic for our kids' },
			{ category: 'POOL', subcategory: 'plaj_deniz', sentiment: 'positive', intensity: 0.9, excerpt: 'beach is beautiful and clean' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.88, excerpt: 'dinner buffet top notch' }
		],
		ownerResponse: 'Thank you so much for your kind words! We are thrilled you enjoyed your stay and that your kids loved the mini club. We hope to welcome you back soon!'
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
			{ category: 'VALUE', subcategory: 'ekstra_ucret', sentiment: 'negative', intensity: 0.8, excerpt: 'цены на дополнительные услуги очень высокие' },
			{ category: 'ROOM', subcategory: 'teknik_oda', sentiment: 'negative', intensity: 0.7, excerpt: 'Wi-Fi в номере слабый' },
			{ category: 'STAFF', subcategory: 'iletisim', sentiment: 'negative', intensity: 0.6, excerpt: 'не все говорят по-русски' }
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
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.92, excerpt: 'Das Personal war sehr freundlich und hilfsbereit' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.9, excerpt: 'besonders das türkische Frühstück' },
			{ category: 'POOL', subcategory: 'havuz', sentiment: 'positive', intensity: 0.85, excerpt: 'Der Pool war sauber und groß genug' }
		],
		ownerResponse: 'Vielen Dank für Ihre wundervolle Bewertung! Es freut uns sehr, dass Ihre Familie eine schöne Zeit hatte.'
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
			{ category: 'VALUE', subcategory: 'para_karsiligi', sentiment: 'negative', intensity: 0.85, excerpt: 'fiyatına göre yetersiz kaldı' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'negative', intensity: 0.7, excerpt: 'aynı yemekler tekrarlanıyordu' },
			{ category: 'FRONT', subcategory: 'check_in_out', sentiment: 'negative', intensity: 0.9, excerpt: 'check-in için bir saatten fazla bekledik' },
			{ category: 'ROOM', subcategory: 'teknik_oda', sentiment: 'negative', intensity: 0.8, excerpt: 'klima düzgün çalışmıyordu' }
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
			{ category: 'SPA', subcategory: 'spa_wellness', sentiment: 'positive', intensity: 0.95, excerpt: 'spa treatments were incredible' },
			{ category: 'ROOM', subcategory: 'konfor', sentiment: 'positive', intensity: 0.9, excerpt: 'Sea view room was stunning' },
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.92, excerpt: 'went above and beyond' }
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
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.75, excerpt: 'Yemekler lezzetli' },
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.8, excerpt: 'personel ilgili' },
			{ category: 'ANIM', subcategory: 'gece_gosteri', sentiment: 'negative', intensity: 0.7, excerpt: 'gece eğlenceleri tekrarlıydı' }
		],
		ownerResponse: 'Geri bildiriminiz için teşekkür ederiz. Animasyon programımızı çeşitlendirmek üzere ekibimizle birlikte çalışıyoruz.'
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
			{ category: 'POOL', subcategory: 'havuz', sentiment: 'negative', intensity: 0.95, excerpt: 'Havuz suyu kirli' },
			{ category: 'FACILITY', subcategory: 'teknik_genel', sentiment: 'negative', intensity: 0.9, excerpt: 'asansörlerden ikisi bozuktu' },
			{ category: 'FRONT', subcategory: 'bilgi_destek', sentiment: 'negative', intensity: 0.95, excerpt: 'Resepsiyon personeli yardımcı olmaktan kaçındı' }
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
			{ category: 'VALUE', subcategory: 'para_karsiligi', sentiment: 'positive', intensity: 0.9, excerpt: 'All-Inclusive-Konzept war umfassend' },
			{ category: 'FACILITY', subcategory: 'konum', sentiment: 'positive', intensity: 0.95, excerpt: 'Die Lage ist perfekt, direkt am Meer' },
			{ category: 'GENERAL', subcategory: 'genel', sentiment: 'positive', intensity: 0.9, excerpt: 'Wir kommen wieder!' }
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
			{ category: 'POOL', subcategory: 'sezlong_alan', sentiment: 'positive', intensity: 0.88, excerpt: 'plenty of sun loungers' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.85, excerpt: 'Breakfast buffet has excellent variety' },
			{ category: 'ROOM', subcategory: 'teknik_oda', sentiment: 'negative', intensity: 0.6, excerpt: 'inconsistent WiFi in our room' }
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
			{ category: 'SPA', subcategory: 'spa_wellness', sentiment: 'positive', intensity: 0.9, excerpt: 'Spa harikaydı' },
			{ category: 'FOOD', subcategory: 'ozel_restoran', sentiment: 'negative', intensity: 0.75, excerpt: 'özel restoranlar rezervasyon almıyordu' },
			{ category: 'ROOM', subcategory: 'havlu_carsaf', sentiment: 'negative', intensity: 0.7, excerpt: 'Çamaşırlarımız 2 günde gelmedi' }
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
			{ category: 'ANIM', subcategory: 'cocuk', sentiment: 'positive', intensity: 0.98, excerpt: 'best week of her life at the kids club' },
			{ category: 'ANIM', subcategory: 'gunduz', sentiment: 'positive', intensity: 0.9, excerpt: 'Daytime activities were fun for all ages' }
		],
		ownerResponse: 'We are delighted your daughter enjoyed her time with us! Our animation team will be thrilled to hear this.'
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
			{ category: 'ROOM', subcategory: 'temizlik', sentiment: 'positive', intensity: 0.95, excerpt: 'odalar tertemizdi' },
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.85, excerpt: 'Kat görevlileri çok titiz' },
			{ category: 'FACILITY', subcategory: 'konum', sentiment: 'negative', intensity: 0.6, excerpt: 'Konum biraz uzak' },
			{ category: 'FACILITY', subcategory: 'genel_gorunum', sentiment: 'positive', intensity: 0.8, excerpt: 'Lobi modern ve geniş' }
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
			{ category: 'FOOD', subcategory: 'servis_hiz', sentiment: 'negative', intensity: 0.7, excerpt: 'Restaurant staff slow during dinner rush' },
			{ category: 'POOL', subcategory: 'plaj_deniz', sentiment: 'positive', intensity: 0.75, excerpt: 'Beach was nice' },
			{ category: 'GENERAL', subcategory: 'genel', sentiment: 'negative', intensity: 0.65, excerpt: 'Felt out of place as a solo traveler' }
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
			{ category: 'STAFF', subcategory: 'tutum', sentiment: 'positive', intensity: 0.92, excerpt: 'Her birimize ayrı ilgi gösterildi' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.88, excerpt: 'Yemek seçenekleri herkesin damak tadına uygundu' },
			{ category: 'GENERAL', subcategory: 'genel', sentiment: 'positive', intensity: 0.95, excerpt: 'Tekrar geleceğiz' }
		],
		ownerResponse: 'Geniş ailenizi ağırlamak bizim için bir onurdu! Tekrar görüşmek üzere.'
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
			{ category: 'SPA', subcategory: 'fitness', sentiment: 'positive', intensity: 0.85, excerpt: 'Das Fitnesscenter ist gut ausgestattet' },
			{ category: 'POOL', subcategory: 'havuz', sentiment: 'positive', intensity: 0.8, excerpt: 'der Pool für Bahnen perfekt' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'negative', intensity: 0.7, excerpt: 'Das Essen war jedoch wiederholend' }
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
			{ category: 'STAFF', subcategory: 'cozum', sentiment: 'positive', intensity: 0.9, excerpt: 'Персонал решает любую проблему быстро' },
			{ category: 'POOL', subcategory: 'havuz', sentiment: 'positive', intensity: 0.85, excerpt: 'Бассейн чистый' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.8, excerpt: 'Питание разнообразное' }
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
			{ category: 'VALUE', subcategory: 'ekstra_ucret', sentiment: 'negative', intensity: 0.95, excerpt: 'bir sürü ek ücret çıktı' },
			{ category: 'VALUE', subcategory: 'para_karsiligi', sentiment: 'negative', intensity: 0.85, excerpt: 'Her şey dahil paket aldık ama' }
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
			{ category: 'ROOM', subcategory: 'konfor', sentiment: 'positive', intensity: 0.95, excerpt: 'most stunning sea view' },
			{ category: 'FOOD', subcategory: 'tat_cesit', sentiment: 'positive', intensity: 0.9, excerpt: 'Breakfast on the terrace was magical' },
			{ category: 'GENERAL', subcategory: 'genel', sentiment: 'positive', intensity: 0.92, excerpt: 'Will definitely recommend to friends' }
		],
		ownerResponse: 'Thank you for the lovely review! We are so glad you enjoyed the view.'
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
			{ category: 'FRONT', subcategory: 'check_in_out', sentiment: 'positive', intensity: 0.95, excerpt: 'Check-in 5 dakikada bitti' },
			{ category: 'FRONT', subcategory: 'bilgi_destek', sentiment: 'positive', intensity: 0.85, excerpt: 'Karşılama içeceği ve odaya bagaj eskortu' },
			{ category: 'FACILITY', subcategory: 'genel_gorunum', sentiment: 'positive', intensity: 0.85, excerpt: 'Otel temiz ve modern' }
		]
	}
];
