<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const r = $derived(data.report);

	const MONTH_LABEL: Record<string, string> = {
		'01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan', '05': 'Mayıs', '06': 'Haziran',
		'07': 'Temmuz', '08': 'Ağustos', '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
	};
	function monthLabel(m: string): string {
		return `${MONTH_LABEL[m.slice(5, 7)] ?? m} ${m.slice(0, 4)}`;
	}
	function monthShort(m: string): string {
		return MONTH_LABEL[m.slice(5, 7)] ?? m;
	}

	const PLATFORM_LABEL: Record<string, string> = {
		google: 'Google',
		tripadvisor: 'TripAdvisor',
		booking: 'Booking',
		holidaycheck: 'HolidayCheck',
		check24: 'Check24'
	};

	function pct(total: number, complaints: number): string {
		if (!total) return '—';
		return `%${(((total - complaints) / total) * 100).toFixed(1).replace('.', ',')}`;
	}
	function num(v: number | undefined): string {
		return v ? String(v) : '0';
	}

	/** Sum one sentiment over all months of a feedback department row. */
	function deptTotal(months: Record<string, Record<string, number>>, s: string): number {
		return Object.values(months).reduce((a, m) => a + (m[s] ?? 0), 0);
	}

	// Topic tables show the volume-ranked head; the tail is summed into "Diğer".
	const TOPIC_ROWS = 15;
	const reviewTopicsHead = $derived(r.topics.slice(0, TOPIC_ROWS));
	const reviewTopicsTail = $derived(r.topics.slice(TOPIC_ROWS));
	const fbTopicsHead = $derived(r.feedback?.topics.slice(0, TOPIC_ROWS) ?? []);
	const fbTopicsTail = $derived(r.feedback?.topics.slice(TOPIC_ROWS) ?? []);

	function tailMonths(tail: { months: Record<string, number> }[]): Record<string, number> {
		const out: Record<string, number> = {};
		for (const t of tail) for (const [m, n] of Object.entries(t.months)) out[m] = (out[m] ?? 0) + n;
		return out;
	}

	const CHOICE_LABEL: Record<string, string> = {
		q_return: 'Tekrar tercih eder misiniz?',
		q_recommend: 'Tavsiye eder misiniz?'
	};
	const OPTION_LABEL: Record<string, string> = { yes: 'Evet', maybe: 'Belki', no: 'Hayır' };
</script>

<svelte:head>
	<title>Denetim Raporu — {r.venueName}</title>
</svelte:head>

<div class="ygg-report mx-auto max-w-5xl">
	<!-- Screen-only toolbar -->
	<div class="print-hide mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-text-1">Denetim Raporu (YGG)</h1>
			<p class="text-sm text-text-3">
				Tüm tablolar gerçek kayıtlardan anlık üretilir — yorumlar, anketler ve misafir geri bildirimleri.
			</p>
		</div>
		<button
			class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
			onclick={() => window.print()}
		>
			Yazdır / PDF
		</button>
	</div>

	{#each r.warnings as w}
		<div class="print-hide mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
			⚠ {w}
		</div>
	{/each}

	<!-- Report header (prints) -->
	<header class="mb-6 border-b-2 border-black/70 pb-3">
		<h2 class="text-2xl font-bold">{r.venueName} — Yönetimin Gözden Geçirmesi Raporu</h2>
		<p class="mt-1 text-sm">
			Dönem: <strong>{monthLabel(r.from)} – {monthLabel(r.to)}</strong>
			· Üretim: {new Date(r.generatedAt).toLocaleString('tr-TR')}
			· Kaynak: ECHO (yorum platformları + otel içi anket + MGB kayıtları)
		</p>
	</header>

	<!-- 1. Platform review stats -->
	<section class="ygg-section">
		<h3>1. Yorum Platformları — Aylık İstatistik</h3>
		<p class="ygg-note">
			Şikâyet/Olumlu: misafirin açık "tavsiye eder misiniz?" cevabı varsa (HolidayCheck) o esas alınır;
			diğer platformlarda 5 üzerinden ≤2 şikâyet, ≥4 olumlu sayılır. Başarı oranı = şikâyet olmayan yorum payı.
		</p>
		{#each r.reviews as p}
			<h4>{PLATFORM_LABEL[p.platform] ?? p.platform}</h4>
			<table>
				<thead>
					<tr>
						<th></th>
						{#each r.months as m}<th>{monthShort(m)}</th>{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Toplam Yorum</td>
						{#each r.months as m}<td>{num(p.months[m]?.total)}</td>{/each}
					</tr>
					<tr>
						<td>Şikâyet (≤2)</td>
						{#each r.months as m}<td>{num(p.months[m]?.complaints)}</td>{/each}
					</tr>
					<tr>
						<td>Olumlu (≥4)</td>
						{#each r.months as m}<td>{num(p.months[m]?.positives)}</td>{/each}
					</tr>
					<tr>
						<td>Başarı Oranı</td>
						{#each r.months as m}
							<td>{p.months[m] ? pct(p.months[m].total, p.months[m].complaints) : '—'}</td>
						{/each}
					</tr>
				</tbody>
			</table>
		{/each}
	</section>

	<!-- 2. Review complaint topics -->
	<section class="ygg-section">
		<h3>2. Yorumlarda Şikâyet Konuları (ABSA)</h3>
		<p class="ygg-note">
			Konular sabit bir listeden değil, yorumlardaki gerçek şikâyet tespitlerinden türetilir; hacme göre sıralıdır.
		</p>
		<table>
			<thead>
				<tr>
					<th>Konu</th>
					{#each r.months as m}<th>{monthShort(m)}</th>{/each}
					<th>Toplam</th>
				</tr>
			</thead>
			<tbody>
				{#each reviewTopicsHead as t}
					<tr>
						<td>{t.label}</td>
						{#each r.months as m}<td>{num(t.months[m])}</td>{/each}
						<td><strong>{t.total}</strong></td>
					</tr>
				{/each}
				{#if reviewTopicsTail.length}
					{@const tm = tailMonths(reviewTopicsTail)}
					<tr>
						<td><em>Diğer ({reviewTopicsTail.length} konu)</em></td>
						{#each r.months as m}<td>{num(tm[m])}</td>{/each}
						<td><strong>{reviewTopicsTail.reduce((a, t) => a + t.total, 0)}</strong></td>
					</tr>
				{/if}
			</tbody>
		</table>
	</section>

	<!-- 3. In-stay survey -->
	<section class="ygg-section">
		<h3>3. Otel İçi Anket — Kategori Puanları</h3>
		{#if r.surveys}
			<p class="ygg-note">
				%100 = tüm cevaplar "mükemmel". Cevap sayısı ayda {Object.values(r.surveys.responded).join(' / ')}
				(gönderilen: {Object.values(r.surveys.sent).join(' / ')}).
			</p>
			<table>
				<thead>
					<tr>
						<th>Kategori</th>
						{#each r.months as m}<th>{monthShort(m)}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each r.surveys.categories as c}
						<tr>
							<td>{c.label}</td>
							{#each r.months as m}
								<td>{c.months[m] ? `%${c.months[m].pct.toFixed(2).replace('.', ',')}` : '—'}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			{#if r.surveys.choices.length}
				<h4>Genel değerlendirme soruları</h4>
				<table>
					<thead>
						<tr>
							<th>Soru</th>
							{#each r.months as m}<th>{monthShort(m)}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each r.surveys.choices as ch}
							<tr>
								<td>{CHOICE_LABEL[ch.key] ?? ch.key}</td>
								{#each r.months as m}
									<td>
										{#if ch.months[m]}
											{Object.entries(ch.months[m])
												.map(([o, n]) => `${OPTION_LABEL[o] ?? o}: ${n}`)
												.join(' · ')}
										{:else}—{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else}
			<p class="ygg-note">Anket verisi şu an alınamadı.</p>
		{/if}
	</section>

	<!-- 4. MGB feedback by department -->
	<section class="ygg-section">
		<h3>4. Misafir Geri Bildirimleri (MGB) — Departman Dağılımı</h3>
		{#if r.feedback}
			<p class="ygg-note">
				Hücreler: Şikâyet / Öneri / Olumlu. "Genel — tüm departmanlar" işaretli kayıtlar departman satırlarına
				dağıtılmaz; Toplam satırı tüm kayıtları içerir.
			</p>
			<table>
				<thead>
					<tr>
						<th>Departman</th>
						{#each r.months as m}<th>{monthShort(m)}</th>{/each}
						<th>Toplam Ş/Ö/O</th>
					</tr>
				</thead>
				<tbody>
					{#each r.feedback.departments as d}
						<tr>
							<td>{d.label}</td>
							{#each r.months as m}
								<td>
									{num(d.months[m]?.negative)} / {num(d.months[m]?.suggestion)} / {num(d.months[m]?.positive)}
								</td>
							{/each}
							<td>
								<strong>
									{deptTotal(d.months, 'negative')} / {deptTotal(d.months, 'suggestion')} / {deptTotal(d.months, 'positive')}
								</strong>
							</td>
						</tr>
					{/each}
					<tr class="ygg-total">
						<td>Toplam (tüm kayıtlar)</td>
						{#each r.months as m}
							{@const t = r.feedback.sentimentTotals[m]}
							<td>{num(t?.negative)} / {num(t?.suggestion)} / {num(t?.positive)}</td>
						{/each}
						<td></td>
					</tr>
				</tbody>
			</table>
		{:else}
			<p class="ygg-note">MGB verisi şu an alınamadı.</p>
		{/if}
	</section>

	<!-- 5. MGB complaint topics -->
	{#if r.feedback}
		<section class="ygg-section">
			<h3>5. MGB Şikâyet Konuları (ABSA)</h3>
			<p class="ygg-note">Geri bildirim metinlerindeki şikâyet tespitleri; hacme göre sıralıdır.</p>
			<table>
				<thead>
					<tr>
						<th>Konu</th>
						{#each r.months as m}<th>{monthShort(m)}</th>{/each}
						<th>Toplam</th>
					</tr>
				</thead>
				<tbody>
					{#each fbTopicsHead as t}
						<tr>
							<td>{t.label}</td>
							{#each r.months as m}<td>{num(t.months[m])}</td>{/each}
							<td><strong>{t.total}</strong></td>
						</tr>
					{/each}
					{#if fbTopicsTail.length}
						{@const tm = tailMonths(fbTopicsTail)}
						<tr>
							<td><em>Diğer ({fbTopicsTail.length} konu)</em></td>
							{#each r.months as m}<td>{num(tm[m])}</td>{/each}
							<td><strong>{fbTopicsTail.reduce((a, t) => a + t.total, 0)}</strong></td>
						</tr>
					{/if}
				</tbody>
			</table>
		</section>
	{/if}

	<footer class="mt-8 border-t border-black/30 pt-2 text-xs">
		Bu rapor ECHO tarafından {new Date(r.generatedAt).toLocaleString('tr-TR')} itibarıyla canlı kayıtlardan
		otomatik üretilmiştir; elle veri girişi içermez.
	</footer>
</div>

<style>
	.ygg-report {
		background: white;
		color: #111;
		padding: 2rem;
		border-radius: 12px;
	}
	.ygg-section {
		margin-bottom: 2rem;
		break-inside: avoid-page;
	}
	.ygg-section h3 {
		font-size: 1.05rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
	}
	.ygg-section h4 {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0.75rem 0 0.25rem;
	}
	.ygg-note {
		font-size: 0.75rem;
		color: #555;
		margin-bottom: 0.5rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
	}
	th,
	td {
		border: 1px solid #bbb;
		padding: 0.25rem 0.45rem;
		text-align: center;
	}
	th:first-child,
	td:first-child {
		text-align: left;
	}
	thead th {
		background: #f0f0f0;
		font-weight: 600;
	}
	.ygg-total td {
		background: #f7f7f7;
		font-weight: 600;
	}

	@media print {
		.print-hide {
			display: none !important;
		}
		.ygg-report {
			padding: 0;
			border-radius: 0;
			max-width: none;
		}
		/* Hide the OS shell chrome (rail nav, banners) — print the report alone. */
		:global(body *) {
			visibility: hidden;
		}
		:global(.ygg-report),
		:global(.ygg-report *) {
			visibility: visible;
		}
		:global(.ygg-report) {
			position: absolute;
			inset: 0;
		}
	}
</style>
