<!--
  ECHO /admin/harvest — scrape health & cost (superadmin only).

  The point of this page is the pair of numbers: `çekilen` (what we pulled from the
  source — the cost) next to `yeni` (what was genuinely new — the value). Either one
  alone misleads: a pass that pulled 22,400 reviews to store 170 looks like a big
  successful harvest if you only read the first, and like a quiet day if you only read
  the second. The gap between them IS the waste, and `verim` names it.
-->
<script lang="ts">
	import type { HarvestRollup, HarvestRunsReport } from '@talkwo/echo-ui';
	import { goto } from '$app/navigation';

	let { data } = $props();
	const report = $derived(data.report as HarvestRunsReport);

	const WINDOWS = [7, 14, 30, 90];

	function setWindow(days: number) {
		goto(`/admin/harvest?days=${days}`, { invalidateAll: true });
	}

	function fmt(n: number | null | undefined): string {
		if (n == null) return '—';
		return n.toLocaleString('tr-TR');
	}

	function fmtYield(y: number | null): string {
		return y == null ? '—' : `${y.toFixed(1)}%`;
	}

	/**
	 * Yield bands. A healthy incremental feed only pulls what is new, so most of what
	 * it fetches is new — google/tripadvisor sit around 60%+. Under 5% means we are
	 * re-downloading history we already have on every single pass.
	 */
	function yieldTone(r: HarvestRollup): 'good' | 'warn' | 'bad' | 'none' {
		if (r.yieldPct == null) return 'none';
		if (r.yieldPct >= 25) return 'good';
		if (r.yieldPct >= 5) return 'warn';
		return 'bad';
	}

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function fmtDuration(ms: number | null | undefined): string {
		if (ms == null) return '—';
		return ms >= 1000 ? `${(ms / 1000).toFixed(1)} sn` : `${ms} ms`;
	}

	const total = $derived(report.total);
	const wasted = $derived(total.fetched - total.inserted);
</script>

<svelte:head><title>Harvest · ECHO</title></svelte:head>

<div class="page">
	<header class="head">
		<div>
			<h1>Harvest — çekim sağlığı & maliyet</h1>
			<p class="sub">
				Gece 07:00'de çalışan tarama turunun geçmişi. <strong>Çekilen</strong> kaynaktan indirdiğimiz
				yorum sayısı (maliyet), <strong>yeni</strong> ise bunların gerçekten yeni olanı (değer). İkisi
				arasındaki fark israftır.
			</p>
		</div>
		<div class="windows">
			{#each WINDOWS as d (d)}
				<button class:active={report.windowDays === d} onclick={() => setWindow(d)}>{d}g</button>
			{/each}
		</div>
	</header>

	{#if report.total.triggers === 0}
		<div class="empty">
			Bu pencerede kayıt yok. Geçmiş, özelliğin devreye girdiği ilk turdan itibaren birikir.
		</div>
	{:else}
		<!-- Headline -->
		<section class="cards">
			<div class="card">
				<span class="label">Tetikleme</span>
				<span class="val">{fmt(total.triggers)}</span>
			</div>
			<div class="card">
				<span class="label">Çekilen (maliyet)</span>
				<span class="val">{fmt(total.fetched)}</span>
			</div>
			<div class="card">
				<span class="label">Yeni (değer)</span>
				<span class="val good">{fmt(total.inserted)}</span>
			</div>
			<div class="card">
				<span class="label">Boşa çekilen</span>
				<span class="val" class:bad={wasted > total.inserted}>{fmt(wasted)}</span>
			</div>
			<div class="card">
				<span class="label">Verim</span>
				<span class="val {yieldTone(total as HarvestRollup)}">{fmtYield(total.yieldPct)}</span>
			</div>
			{#if total.errors > 0}
				<div class="card">
					<span class="label">Hata</span>
					<span class="val bad">{fmt(total.errors)}</span>
				</div>
			{/if}
		</section>

		{#if report.errors.length > 0}
			<section class="block">
				<h2>Hatalar</h2>
				<ul class="errors">
					{#each report.errors as e (e.platform + e.message)}
						<li>
							<span class="plat">{e.platform}</span>
							<span class="msg">{e.message}</span>
							<span class="meta">
								×{e.count} · {e.venues.slice(0, 3).join(', ')}{e.venues.length > 3
									? ` +${e.venues.length - 3}`
									: ''} · son: {fmtDate(e.lastSeen)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Platform: where the waste is -->
		<section class="block">
			<h2>Platform bazında</h2>
			<table>
				<thead>
					<tr>
						<th>Platform</th>
						<th class="n">Tetikleme</th>
						<th class="n">Çekilen</th>
						<th class="n">Yeni</th>
						<th class="n">Yeniden yazılan</th>
						<th class="n">Verim</th>
						<th class="n">Tam tarama</th>
					</tr>
				</thead>
				<tbody>
					{#each report.byPlatform as p (p.key)}
						<tr>
							<td class="k">{p.key}</td>
							<td class="n">{fmt(p.triggers)}</td>
							<td class="n">{fmt(p.fetched)}</td>
							<td class="n good">{fmt(p.inserted)}</td>
							<td class="n dim">{fmt(p.updated)}</td>
							<td class="n {yieldTone(p)}">{fmtYield(p.yieldPct)}</td>
							<td class="n" class:warn={p.fullScans > 0}>{fmt(p.fullScans)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- Day by day -->
		<section class="block">
			<h2>Gün bazında</h2>
			<table>
				<thead>
					<tr>
						<th>Gün</th>
						<th class="n">Tetikleme</th>
						<th class="n">Çekilen</th>
						<th class="n">Yeni</th>
						<th class="n">Verim</th>
						<th class="n">Hata</th>
					</tr>
				</thead>
				<tbody>
					{#each report.byDay as d (d.key)}
						<tr>
							<td class="k">{d.key}</td>
							<td class="n">{fmt(d.triggers)}</td>
							<td class="n">{fmt(d.fetched)}</td>
							<td class="n good">{fmt(d.inserted)}</td>
							<td class="n {yieldTone(d)}">{fmtYield(d.yieldPct)}</td>
							<td class="n" class:bad={d.errors > 0}>{d.errors || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- Drill-down -->
		<section class="block">
			<h2>Son tetiklemeler</h2>
			<table>
				<thead>
					<tr>
						<th>Zaman</th>
						<th>Platform</th>
						<th>Tesis</th>
						<th>Mod</th>
						<th class="n">Çekilen</th>
						<th class="n">Yeni</th>
						<th class="n">Süre</th>
						<th>Durum</th>
					</tr>
				</thead>
				<tbody>
					{#each report.recent as r (r.ranAt + r.venueSlug + r.platform)}
						<tr>
							<td class="dim">{fmtDate(r.ranAt)}</td>
							<td>{r.platform}</td>
							<td class="k">{r.venueSlug}</td>
							<td>
								<span class="mode" class:full={r.mode === 'full'}>
									{r.mode === 'full' ? 'tam' : 'artımlı'}
								</span>
							</td>
							<td class="n">{fmt(r.fetched)}</td>
							<td class="n good">{fmt(r.inserted)}</td>
							<td class="n dim">{fmtDuration(r.durationMs)}</td>
							<td>
								{#if r.status === 'error'}
									<span class="pill bad" title={r.error ?? ''}>hata</span>
								{:else}
									<span class="pill ok">ok</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: 1.5rem;
		max-width: 1200px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	h1 {
		font-size: 1.35rem;
		margin: 0 0 0.35rem;
	}
	.sub {
		margin: 0;
		color: var(--text-muted, #6b7280);
		font-size: 0.85rem;
		max-width: 62ch;
		line-height: 1.5;
	}
	.windows {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}
	.windows button {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--border, #d1d5db);
		background: transparent;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.windows button.active {
		background: var(--accent, #2563eb);
		color: #fff;
		border-color: transparent;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 8px;
		min-width: 8.5rem;
	}
	.card .label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #6b7280);
	}
	.card .val {
		font-size: 1.4rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.block {
		margin-bottom: 2rem;
	}
	h2 {
		font-size: 0.95rem;
		margin: 0 0 0.6rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}
	th,
	td {
		padding: 0.45rem 0.6rem;
		text-align: left;
		border-bottom: 1px solid var(--border, #eef0f3);
	}
	th {
		font-weight: 600;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-muted, #6b7280);
	}
	td.n,
	th.n {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	td.k {
		font-weight: 500;
	}
	td.dim {
		color: var(--text-muted, #9ca3af);
	}

	.good {
		color: #059669;
	}
	.warn {
		color: #d97706;
	}
	.bad {
		color: #dc2626;
	}

	.mode {
		font-size: 0.72rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		background: #ecfdf5;
		color: #047857;
	}
	.mode.full {
		background: #fef3c7;
		color: #92400e;
	}

	.pill {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
	}
	.pill.ok {
		background: #ecfdf5;
		color: #047857;
	}
	.pill.bad {
		background: #fee2e2;
		color: #b91c1c;
		cursor: help;
	}

	.errors {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.errors li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid #fecaca;
		background: #fef2f2;
		border-radius: 6px;
		font-size: 0.8rem;
	}
	.errors .plat {
		font-weight: 600;
		color: #b91c1c;
	}
	.errors .meta {
		color: var(--text-muted, #9ca3af);
		font-size: 0.75rem;
	}

	.empty {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted, #6b7280);
		border: 1px dashed var(--border, #d1d5db);
		border-radius: 8px;
	}
</style>
