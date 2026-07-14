<script lang="ts">
	// Presentation hub — the page a prospect lands on after opening a demo link.
	//
	// It is a guided tour, not a link dump: the cards run big-picture → detail (how is the
	// hotel doing → where is it going wrong → who owns the fix), which is the arc a demo
	// naturally wants. Each card says what the screen shows AND which question it answers,
	// so whoever is presenting does not have to remember the script.
	import { TrendingUp, Globe, Swords, Users, MessageSquareReply, Quote, ArrowRight } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const scenarios = [
		{
			icon: TrendingUp,
			title: 'Otelin Genel Durumu',
			href: '/os',
			question: 'Otelim şu an nerede duruyor?',
			blurb:
				'Tek ekranda itibar skoru (GPI), rakiplere göre konum (RPI), kanal kanal performans ve ' +
				'misafirlerin en çok konuştuğu konular.'
		},
		{
			icon: Globe,
			title: 'Kanal Bazlı Performans',
			href: '/os/platform',
			question: 'Hangi platformda geriye düşüyorum?',
			blurb:
				'TripAdvisor, Google, Booking ve HolidayCheck yan yana. Aynı otel, farklı kitleler — ' +
				've çoğu zaman çok farklı puanlar.'
		},
		{
			icon: Swords,
			title: 'Rakip Karşılaştırması',
			href: '/os/competitors',
			question: 'Rakiplerim ne yapıyor?',
			blurb:
				'Bölgedeki oteller kategori kategori karşılaştırılıyor. Nerede öndesiniz, nerede ' +
				'geridesiniz — tahminle değil, veriyle.'
		},
		{
			icon: Users,
			title: 'Departman Sağlığı',
			href: '/os/departments',
			question: 'Sorunu kim çözecek?',
			blurb:
				'Misafir şikâyetleri departmanlara dağıtılıyor: kat hizmetleri, mutfak, ön büro… ' +
				'Her ekip kendi skorunu ve kendi şikâyetlerini görüyor.'
		},
		{
			icon: MessageSquareReply,
			title: 'Yanıt Yönetimi',
			href: '/os/platform/tripadvisor',
			question: 'Hangi yoruma önce cevap vermeliyim?',
			blurb:
				'Yanıtsız yorumlar önceliklendirilmiş bir kutuda. Yanıt oranı, yanıt süresi ve ' +
				'cevapsız kalan olumsuz yorumlar tek yerde.'
		},
		{
			icon: Quote,
			title: 'Yorum Gezgini',
			href: '/os/platform/google',
			question: 'Misafirler tam olarak ne diyor?',
			blurb:
				'Skorların arkasındaki cümleler. Her yorum konu konu etiketlenmiş — "yemek" değil, ' +
				'"kahvaltıda çeşit az" düzeyinde.'
		}
	];
</script>

<svelte:head>
	<title>ECHO — Demo</title>
</svelte:head>

<div class="min-h-screen bg-bg">
	<div class="mx-auto max-w-5xl px-6 py-12">
		<!-- Header -->
		<header class="mb-2">
			<div
				class="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark"
			>
				DEMO ORTAMI
			</div>
			<h1 class="mt-4 text-3xl font-bold tracking-tight text-text-1">ECHO</h1>
			<p class="mt-1 text-lg text-text-2">
				Otel itibar yönetimi — <span class="font-semibold text-text-1">{data.venueName}</span>
			</p>
		</header>

		<!-- The honesty banner. A viewer must never mistake this for a real property's data. -->
		<div
			class="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-text-2"
		>
			<span aria-hidden="true">ℹ️</span>
			<p>
				Bu ortamdaki tüm veriler <strong class="font-semibold text-text-1"
					>anonimleştirilmiş örnek verilerdir</strong
				>. Otel ve rakip isimleri kurgudur; skorlar, yorumlar ve grafikler gerçek bir otelin
				verisinden türetilmiş, kimliği tamamen kaldırılmıştır.
			</p>
		</div>

		<!-- Scenario cards -->
		<h2 class="mt-10 mb-4 text-sm font-semibold tracking-wide text-text-3 uppercase">
			Nereden başlamak istersiniz?
		</h2>

		<div class="grid gap-4 sm:grid-cols-2">
			{#each scenarios as s (s.href)}
				<a
					href={s.href}
					class="group flex flex-col rounded-xl border border-border bg-surface-1 p-5 transition
					       hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
				>
					<div class="flex items-start gap-3">
						<div class="rounded-lg bg-brand-light p-2 text-brand-dark">
							<s.icon size={18} />
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-text-1">{s.title}</h3>
							<p class="mt-0.5 text-sm font-medium text-brand-dark">"{s.question}"</p>
						</div>
					</div>
					<p class="mt-3 text-sm leading-relaxed text-text-2">{s.blurb}</p>
					<div
						class="mt-4 flex items-center gap-1 text-sm font-medium text-text-3 transition group-hover:text-brand-dark"
					>
						Ekranı aç
						<ArrowRight size={14} class="transition group-hover:translate-x-0.5" />
					</div>
				</a>
			{/each}
		</div>

		<!-- Footer -->
		<footer class="mt-10 border-t border-border pt-6 text-sm text-text-3">
			<p>
				Panelin tamamı gezilebilir — üstteki menüden diğer ekranlara da geçebilirsiniz. Demo
				oturumu salt-okunurdur: ayar değiştirme ve yönetim ekranları kapalıdır.
			</p>
		</footer>
	</div>
</div>
