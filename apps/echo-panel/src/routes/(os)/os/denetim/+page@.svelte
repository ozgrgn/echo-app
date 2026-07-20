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
	// Months that haven't happened yet render as em-dash, not a misleading zero.
	const currentMonth = new Date().toISOString().slice(0, 7);
	function num(v: number | undefined, m?: string): string {
		if (m && m > currentMonth) return '—';
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

	// ── Charts (inline SVG, print-safe) ─────────────────────────────────────
	// Palette validated with the dataviz six-checks script (blue/orange pair:
	// all PASS on the light surface). 2025 rides as gray context (emphasis form).
	const C = { cur: '#2a78d6', prev: '#9a9992', neg: '#eb6834', neutral: '#b5b4ae', grid: '#ececea' };

	type MonthStats = { total: number; complaints: number; positives: number };
	interface Pt {
		i: number;
		v: number | null;
	}

	function sumMonth(
		list: { months: Record<string, MonthStats> }[],
		m: string,
		field: 'total' | 'complaints'
	): number {
		return list.reduce((a, p) => a + (p.months[m]?.[field] ?? 0), 0);
	}

	// Series over the full season axis; the current season stops at this month.
	const vol26: Pt[] = $derived(
		r.months.map((m, i) => ({ i, v: m > currentMonth ? null : sumMonth(r.reviews, m, 'total') }))
	);
	const vol25: Pt[] = $derived(
		r.months.map((_, i) => ({ i, v: sumMonth(r.reviewsPrevYear, r.prevMonths[i], 'total') }))
	);
	function successPts(list: { months: Record<string, MonthStats> }[], months: string[], cutoff: boolean): Pt[] {
		return months.map((m, i) => {
			if (cutoff && r.months[i] > currentMonth) return { i, v: null };
			const t = sumMonth(list, m, 'total');
			const c = sumMonth(list, m, 'complaints');
			return { i, v: t ? ((t - c) / t) * 100 : null };
		});
	}
	const succ26: Pt[] = $derived(successPts(r.reviews, r.months, true));
	const succ25: Pt[] = $derived(successPts(r.reviewsPrevYear, r.prevMonths, false));

	// Line-chart geometry (shared by both line charts).
	const LW = 760, LH = 200, LPAD = { l: 40, r: 64, t: 12, b: 22 };
	function xPos(i: number): number {
		return LPAD.l + (i * (LW - LPAD.l - LPAD.r)) / Math.max(1, r.months.length - 1);
	}
	function yScale(min: number, max: number): (v: number) => number {
		return (v) => LH - LPAD.b - ((v - min) / (max - min)) * (LH - LPAD.t - LPAD.b);
	}
	function pathOf(pts: Pt[], y: (v: number) => number): string {
		let d = '';
		for (const p of pts) {
			if (p.v == null) continue;
			d += (d ? ' L' : 'M') + `${xPos(p.i).toFixed(1)},${y(p.v).toFixed(1)}`;
		}
		return d;
	}
	function lastPt(pts: Pt[]): Pt | null {
		const filled = pts.filter((p) => p.v != null);
		return filled.length ? filled[filled.length - 1] : null;
	}
	function niceTicks(min: number, max: number, n = 4): number[] {
		const span = max - min || 1;
		const step = Math.pow(10, Math.floor(Math.log10(span / n)));
		const s = [1, 2, 5, 10].map((k) => k * step).find((k) => span / k <= n + 1) ?? step;
		const out: number[] = [];
		for (let v = Math.ceil(min / s) * s; v <= max; v += s) out.push(Math.round(v * 100) / 100);
		return out;
	}
	const volMax = $derived(Math.max(...vol26.map((p) => p.v ?? 0), ...vol25.map((p) => p.v ?? 0)) * 1.12 || 10);
	const succVals = $derived([...succ26, ...succ25].filter((p) => p.v != null).map((p) => p.v as number));
	const succMin = $derived(Math.max(0, Math.floor(Math.min(80, ...succVals) / 5) * 5 - 5));
	const yVol = $derived(yScale(0, volMax));
	const ySucc = $derived(yScale(succMin, 100));

	// MGB monthly sentiment (grouped columns).
	const fbMonths = $derived(
		r.feedback
			? r.months
					.filter((m) => m <= currentMonth)
					.map((m) => ({
						m,
						olumlu: r.feedback!.sentimentTotals[m]?.positive ?? 0,
						sikayet: r.feedback!.sentimentTotals[m]?.negative ?? 0,
						oneri: r.feedback!.sentimentTotals[m]?.suggestion ?? 0
					}))
			: []
	);
	const fbMax = $derived(Math.max(...fbMonths.flatMap((e) => [e.olumlu, e.sikayet, e.oneri]), 1) * 1.15);

	// Top review complaint topics (horizontal bars, single sequential hue).
	const topTopics = $derived(r.topics.slice(0, 8));
	const topicMax = $derived(Math.max(...topTopics.map((t) => t.total), 1));

	/** Column with a 4px rounded data-end and a square baseline. */
	function colPath(x: number, yTop: number, w: number, yBase: number): string {
		const rr = Math.min(4, w / 2);
		return `M${x},${yBase} L${x},${yTop + rr} Q${x},${yTop} ${x + rr},${yTop} L${x + w - rr},${yTop} Q${x + w},${yTop} ${x + w},${yTop + rr} L${x + w},${yBase} Z`;
	}
	/** Horizontal bar with a 4px rounded data-end, square at the left baseline. */
	function rowPath(x0: number, y: number, w: number, h: number): string {
		const rr = Math.min(4, h / 2);
		return `M${x0},${y} L${x0 + w - rr},${y} Q${x0 + w},${y} ${x0 + w},${y + rr} L${x0 + w},${y + h - rr} Q${x0 + w},${y + h} ${x0 + w - rr},${y + h} L${x0},${y + h} Z`;
	}
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

	<!-- 0. Overview charts -->
	<section class="ygg-section">
		<h3>Genel Görünüm</h3>

		<div class="ygg-chartgrid">
			<figure>
				<figcaption>
					Toplam yorum hacmi (tüm platformlar)
					<span class="ygg-legend">
						<i style="background:{C.cur}"></i>{r.from.slice(0, 4)}
						<i style="background:{C.prev}"></i>{r.prevMonths[0]?.slice(0, 4)}
					</span>
				</figcaption>
				<svg viewBox="0 0 {LW} {LH}" role="img" aria-label="Aylık toplam yorum sayısı, iki sezon">
					{#each niceTicks(0, volMax) as t}
						<line x1={LPAD.l} x2={LW - LPAD.r} y1={yVol(t)} y2={yVol(t)} stroke={C.grid} stroke-width="1" />
						<text x={LPAD.l - 6} y={yVol(t) + 3} class="ygg-tick" text-anchor="end">{t}</text>
					{/each}
					{#each r.months as m, i}
						<text x={xPos(i)} y={LH - 6} class="ygg-tick" text-anchor="middle">{monthShort(m).slice(0, 3)}</text>
					{/each}
					<path d={pathOf(vol25, yVol)} fill="none" stroke={C.prev} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
					<path d={pathOf(vol26, yVol)} fill="none" stroke={C.cur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
					{#each [{ pts: vol25, c: C.prev, yy: r.prevMonths[0]?.slice(0, 4) }, { pts: vol26, c: C.cur, yy: r.from.slice(0, 4) }] as s}
						{@const lp = lastPt(s.pts)}
						{#if lp}
							<circle cx={xPos(lp.i)} cy={yVol(lp.v!)} r="4" fill={s.c} stroke="#fff" stroke-width="2" />
							<text x={xPos(lp.i) + 8} y={yVol(lp.v!) + 4} class="ygg-endlabel">{s.yy}: {lp.v}</text>
						{/if}
					{/each}
					{#each vol26 as p}
						{#if p.v != null}<circle cx={xPos(p.i)} cy={yVol(p.v)} r="7" fill="transparent"><title>{monthShort(r.months[p.i])}: {p.v} yorum</title></circle>{/if}
					{/each}
				</svg>
			</figure>

			<figure>
				<figcaption>
					Başarı oranı % (şikâyet olmayan yorum payı)
					<span class="ygg-legend">
						<i style="background:{C.cur}"></i>{r.from.slice(0, 4)}
						<i style="background:{C.prev}"></i>{r.prevMonths[0]?.slice(0, 4)}
					</span>
				</figcaption>
				<svg viewBox="0 0 {LW} {LH}" role="img" aria-label="Aylık başarı oranı, iki sezon">
					{#each niceTicks(succMin, 100) as t}
						<line x1={LPAD.l} x2={LW - LPAD.r} y1={ySucc(t)} y2={ySucc(t)} stroke={C.grid} stroke-width="1" />
						<text x={LPAD.l - 6} y={ySucc(t) + 3} class="ygg-tick" text-anchor="end">%{t}</text>
					{/each}
					{#each r.months as m, i}
						<text x={xPos(i)} y={LH - 6} class="ygg-tick" text-anchor="middle">{monthShort(m).slice(0, 3)}</text>
					{/each}
					<path d={pathOf(succ25, ySucc)} fill="none" stroke={C.prev} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
					<path d={pathOf(succ26, ySucc)} fill="none" stroke={C.cur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
					{#each [{ pts: succ25, c: C.prev, yy: r.prevMonths[0]?.slice(0, 4) }, { pts: succ26, c: C.cur, yy: r.from.slice(0, 4) }] as s}
						{@const lp = lastPt(s.pts)}
						{#if lp}
							<circle cx={xPos(lp.i)} cy={ySucc(lp.v!)} r="4" fill={s.c} stroke="#fff" stroke-width="2" />
							<text x={xPos(lp.i) + 8} y={ySucc(lp.v!) + 4} class="ygg-endlabel">{s.yy}: %{lp.v!.toFixed(1).replace('.', ',')}</text>
						{/if}
					{/each}
					{#each succ26 as p}
						{#if p.v != null}<circle cx={xPos(p.i)} cy={ySucc(p.v)} r="7" fill="transparent"><title>{monthShort(r.months[p.i])}: %{p.v.toFixed(1)}</title></circle>{/if}
					{/each}
				</svg>
			</figure>

			{#if fbMonths.length}
				{@const yFb = yScale(0, fbMax)}
				{@const groupW = (LW - LPAD.l - LPAD.r) / r.months.length}
				{@const colW = Math.min(18, (groupW - 16) / 3)}
				<figure>
					<figcaption>
						MGB geri bildirim dağılımı
						<span class="ygg-legend">
							<i style="background:{C.cur}"></i>Olumlu
							<i style="background:{C.neg}"></i>Şikâyet
							<i style="background:{C.neutral}"></i>Öneri
						</span>
					</figcaption>
					<svg viewBox="0 0 {LW} {LH}" role="img" aria-label="Aylık misafir geri bildirim dağılımı">
						{#each niceTicks(0, fbMax) as t}
							<line x1={LPAD.l} x2={LW - LPAD.r} y1={yFb(t)} y2={yFb(t)} stroke={C.grid} stroke-width="1" />
							<text x={LPAD.l - 6} y={yFb(t) + 3} class="ygg-tick" text-anchor="end">{t}</text>
						{/each}
						{#each fbMonths as e, gi}
							{@const gx = LPAD.l + gi * groupW + groupW / 2}
							<text x={gx} y={LH - 6} class="ygg-tick" text-anchor="middle">{monthShort(e.m).slice(0, 3)}</text>
							{#each [{ v: e.olumlu, c: C.cur, n: 'Olumlu' }, { v: e.sikayet, c: C.neg, n: 'Şikâyet' }, { v: e.oneri, c: C.neutral, n: 'Öneri' }] as col, ci}
								{@const x = gx - (colW * 3 + 4) / 2 + ci * (colW + 2)}
								<path d={colPath(x, yFb(col.v), colW, LH - LPAD.b)} fill={col.c}>
									<title>{monthShort(e.m)} — {col.n}: {col.v}</title>
								</path>
							{/each}
						{/each}
					</svg>
				</figure>
			{/if}

			<figure>
				<figcaption>Yorumlarda en sık şikâyet konuları (sezon toplamı)</figcaption>
				<svg viewBox="0 0 {LW} {topTopics.length * 30 + 10}" role="img" aria-label="En sık şikâyet konuları">
					{#each topTopics as t, i}
						{@const y = i * 30 + 6}
						{@const w = ((LW - 260) * t.total) / topicMax}
						<text x="196" y={y + 13} class="ygg-tick" text-anchor="end">{t.label}</text>
						<path d={rowPath(204, y, Math.max(w, 6), 18)} fill={C.cur}>
							<title>{t.label}: {t.total} şikâyet</title>
						</path>
						<text x={204 + Math.max(w, 6) + 6} y={y + 13} class="ygg-endlabel">{t.total}</text>
					{/each}
				</svg>
			</figure>
		</div>
	</section>

	<!-- 1. Platform review stats -->
	<section class="ygg-section">
		<h3>1. Yorum Platformları — Aylık İstatistik</h3>
		<p class="ygg-note">
			Şikâyet/Olumlu: misafirin açık "tavsiye eder misiniz?" cevabı varsa (HolidayCheck) o esas alınır;
			diğer platformlarda 5 üzerinden ≤2 şikâyet, ≥4 olumlu sayılır. Başarı oranı = şikâyet olmayan yorum payı.
		</p>
		{#each r.reviews as p}
			{@const prev = r.reviewsPrevYear.find((x) => x.platform === p.platform)}
			{@const curYear = r.from.slice(0, 4)}
			{@const prevYear = r.prevMonths[0]?.slice(0, 4) ?? ''}
			<h4>{PLATFORM_LABEL[p.platform] ?? p.platform}</h4>
			<!-- Deck layout: months as rows, the two seasons side by side. -->
			<table>
				<thead>
					<tr>
						<th></th>
						<th colspan="3" class="ygg-yearhead">{prevYear} {PLATFORM_LABEL[p.platform] ?? p.platform}</th>
						<th colspan="3" class="ygg-yearhead">{curYear} {PLATFORM_LABEL[p.platform] ?? p.platform}</th>
					</tr>
					<tr>
						<th></th>
						<th>Toplam Yorum</th>
						<th>Tavsiye Etmeyen / Şikâyet</th>
						<th>Başarı Oranı</th>
						<th>Toplam Yorum</th>
						<th>Tavsiye Etmeyen / Şikâyet</th>
						<th>Başarı Oranı</th>
					</tr>
				</thead>
				<tbody>
					{#each r.months as m, i}
						{@const pm = r.prevMonths[i]}
						{@const pe = prev?.months[pm]}
						{@const ce = p.months[m]}
						<tr>
							<td>{monthShort(m).toUpperCase()}</td>
							<td class="ygg-prevcell">{num(pe?.total)}</td>
							<td class="ygg-prevcell">{num(pe?.complaints)}</td>
							<td class="ygg-prevcell">{pe ? pct(pe.total, pe.complaints) : '—'}</td>
							<td>{num(ce?.total, m)}</td>
							<td>{num(ce?.complaints, m)}</td>
							<td>{m > currentMonth ? '—' : ce ? pct(ce.total, ce.complaints) : '—'}</td>
						</tr>
					{/each}
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
						{#each r.months as m}<td>{num(t.months[m], m)}</td>{/each}
						<td><strong>{t.total}</strong></td>
					</tr>
				{/each}
				{#if reviewTopicsTail.length}
					{@const tm = tailMonths(reviewTopicsTail)}
					<tr>
						<td><em>Diğer ({reviewTopicsTail.length} konu)</em></td>
						{#each r.months as m}<td>{num(tm[m], m)}</td>{/each}
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
			{@const prevSurvey = r.surveysPrevYear}
			{@const curYY = r.from.slice(2, 4)}
			{@const prevYY = prevSurvey?.year.slice(2, 4) ?? ''}
			<p class="ygg-note">
				%100 = tüm cevaplar "mükemmel". Aylık cevap sayısı:
				{Object.entries(r.surveys.responded).sort().map(([m, v]) => `${monthShort(m)} ${v}`).join(' · ')}.
				{#if prevSurvey}{prevSurvey.year} kolonları geçmiş sezon raporundan elle aktarılmıştır.{/if}
			</p>
			<table>
				<thead>
					<tr>
						<th>Kategori</th>
						{#each r.months as m}
							{#if prevSurvey}<th class="ygg-prevcell">{monthShort(m).slice(0, 3)}.{prevYY}</th>{/if}
							<th>{monthShort(m).slice(0, 3)}.{curYY}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each r.surveys.categories as c}
						{@const pc = prevSurvey?.categories.find((x) => x.key === c.key)}
						<tr>
							<td>{c.label}</td>
							{#each r.months as m, i}
								{#if prevSurvey}
									{@const pv = pc?.months[r.prevMonths[i]]}
									<td class="ygg-prevcell">{pv != null ? `%${pv.toFixed(2).replace('.', ',')}` : '—'}</td>
								{/if}
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
									{num(d.months[m]?.negative, m)} / {num(d.months[m]?.suggestion, m)} / {num(d.months[m]?.positive, m)}
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
							<td>{num(t?.negative, m)} / {num(t?.suggestion, m)} / {num(t?.positive, m)}</td>
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
							{#each r.months as m}<td>{num(t.months[m], m)}</td>{/each}
							<td><strong>{t.total}</strong></td>
						</tr>
					{/each}
					{#if fbTopicsTail.length}
						{@const tm = tailMonths(fbTopicsTail)}
						<tr>
							<td><em>Diğer ({fbTopicsTail.length} konu)</em></td>
							{#each r.months as m}<td>{num(tm[m], m)}</td>{/each}
							<td><strong>{fbTopicsTail.reduce((a, t) => a + t.total, 0)}</strong></td>
						</tr>
					{/if}
				</tbody>
			</table>
		</section>
	{/if}

	<!-- Ekstra Satışlar (a la carte + pavilyon) bölümü şimdilik kaldırıldı —
	     rezervasyon kayıtlarındaki ciro eksik girildiği için (owner, 2026-07-20).
	     Veri backend'de hazır (r.dining); geri almak için git geçmişindeki bölümü koy. -->

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
	.ygg-chartgrid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	.ygg-chartgrid figure {
		margin: 0;
		border: 1px solid #e4e4e2;
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		break-inside: avoid-page;
	}
	.ygg-chartgrid figcaption {
		font-size: 0.8rem;
		font-weight: 600;
		margin-bottom: 0.35rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.ygg-legend {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		font-weight: 400;
		color: #555;
	}
	.ygg-legend i {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.ygg-chartgrid svg {
		width: 100%;
		height: auto;
		display: block;
	}
	:global(.ygg-tick) {
		font-size: 10px;
		fill: #6b6a66;
	}
	:global(.ygg-endlabel) {
		font-size: 11px;
		font-weight: 600;
		fill: #0b0b0b;
	}
	@media (max-width: 900px) {
		.ygg-chartgrid {
			grid-template-columns: 1fr;
		}
	}
	.ygg-yearhead {
		background: #e2e6ec;
		font-weight: 700;
	}
	.ygg-prevcell {
		color: #555;
		background: #fafafa;
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
