<script lang="ts">
	import type { VenueRouteRow } from '@talkwo/echo-ui';

	let { data } = $props();

	// Live editable copy of the snapshot rows (keyed by route_key). Seeded once from
	// the load data; mutated in place on save (server returns the canonical row).
	let rows = $state<VenueRouteRow[]>([...data.catalog.rows]);
	const allowedOwners = $derived(data.catalog.allowed_owners);

	// System buckets render distinctly in the dropdown (not real departments).
	const SYSTEM_BUCKETS = new Set(['w0', 'external', 'manual_review']);

	// ── Filters ──────────────────────────────────────────────────────────────
	type ModeFilter = 'all' | 'owner_router' | 'direct_map' | 'no_score' | 'critical' | 'changed';
	let modeFilter = $state<ModeFilter>('all');
	let search = $state('');

	const MODE_LABEL: Record<string, string> = {
		owner_router: 'Owner Router',
		direct_map: 'Direct',
		no_score: 'Skorsuz',
		critical: 'Kritik'
	};
	const MODE_STYLE: Record<string, string> = {
		owner_router: 'bg-brand-light text-brand-dark',
		direct_map: 'bg-surface-3 text-text-2',
		no_score: 'bg-surface-2 text-text-3',
		critical: 'bg-danger-light text-danger'
	};

	const filters: { key: ModeFilter; label: string }[] = [
		{ key: 'all', label: 'Tümü' },
		{ key: 'owner_router', label: 'Owner Router' },
		{ key: 'direct_map', label: 'Direct' },
		{ key: 'no_score', label: 'Skorsuz' },
		{ key: 'critical', label: 'Kritik' },
		{ key: 'changed', label: 'Değiştirilmiş' }
	];

	const filtered = $derived.by(() => {
		const q = search.trim().toLocaleLowerCase('tr');
		return rows.filter((r) => {
			if (modeFilter === 'changed') {
				if (!r.is_customized) return false;
			} else if (modeFilter !== 'all' && r.routing_mode !== modeFilter) {
				return false;
			}
			if (!q) return true;
			return (
				r.route_label.toLocaleLowerCase('tr').includes(q) ||
				r.subcategory.toLowerCase().includes(q) ||
				(r.venue_owner_key ?? '').toLowerCase().includes(q)
			);
		});
	});

	// Group the filtered rows by category (stable order = first appearance).
	const grouped = $derived.by(() => {
		const map = new Map<string, VenueRouteRow[]>();
		for (const r of filtered) {
			const list = map.get(r.category) ?? [];
			list.push(r);
			map.set(r.category, list);
		}
		return [...map.entries()];
	});

	const changedCount = $derived(rows.filter((r) => r.is_customized).length);

	// ── Per-row save ───────────────────────────────────────────────────────────
	// Track save state per route_key so each row shows its own status.
	let saving = $state<Record<string, 'saving' | 'saved' | 'error'>>({});

	async function saveRow(row: VenueRouteRow, patch: { venue_owner_key?: string; enabled?: boolean }) {
		saving = { ...saving, [row.route_key]: 'saving' };
		try {
			const res = await fetch('/api/owner-routing', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ venueSlug: data.venueSlug, routeKey: row.route_key, patch })
			});
			if (!res.ok) throw new Error(String(res.status));
			const { row: updated } = (await res.json()) as { row: VenueRouteRow };
			// Replace the row in place with the server's canonical version (is_customized etc.).
			rows = rows.map((r) => (r.route_key === updated.route_key ? updated : r));
			saving = { ...saving, [row.route_key]: 'saved' };
			setTimeout(() => {
				const { [row.route_key]: _, ...rest } = saving;
				saving = rest;
			}, 1500);
		} catch {
			saving = { ...saving, [row.route_key]: 'error' };
		}
	}

	function onOwnerChange(row: VenueRouteRow, next: string) {
		if (next === row.venue_owner_key) return;
		saveRow(row, { venue_owner_key: next });
	}

	function ownerLabel(key: string): string {
		if (key === 'w0') return 'w0 (kontrol dışı)';
		if (key === 'external') return 'external (dış partner)';
		if (key === 'manual_review') return 'manual_review (elle)';
		return key;
	}
</script>

<div class="space-y-6">
	<header>
		<h1 class="text-xl font-semibold text-text-1">Owner Routing Ayarları</h1>
		<p class="mt-1 text-sm text-text-2">
			Her konu satırının hangi departmana yönlendirileceğini bu otel için belirleyin.
			<span class="text-text-3">
				Owner Router satırlarında seçtiğiniz departman modele <em>ipucu</em> olur; kesin
				(direct) satırlarda doğrudan uygulanır. Routing modu ve global varsayılan salt-okunurdur.
			</span>
		</p>
		<p class="mt-1 text-xs text-text-3">
			{data.venueName} · {rows.length} satır · {changedCount} değiştirilmiş · katalog {data.catalog.catalog_version}
		</p>
	</header>

	<!-- Filters + search -->
	<div class="flex flex-wrap items-center gap-2">
		{#each filters as f (f.key)}
			<button
				class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
					{modeFilter === f.key
						? 'bg-brand text-white border-brand'
						: 'bg-surface-1 text-text-2 border-border hover:text-text-1'}"
				onclick={() => (modeFilter = f.key)}
			>
				{f.label}{#if f.key === 'changed' && changedCount > 0}&nbsp;({changedCount}){/if}
			</button>
		{/each}
		<input
			type="search"
			bind:value={search}
			placeholder="Ara: konu, subcategory, departman…"
			class="ml-auto w-64 max-w-full px-3 py-1.5 text-sm rounded-md border border-border bg-surface-1
				text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
		/>
	</div>

	{#if filtered.length === 0}
		<p class="py-12 text-center text-sm text-text-3">Bu filtreyle eşleşen satır yok.</p>
	{/if}

	{#each grouped as [category, catRows] (category)}
		<section>
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">{category}</h2>
			<div class="overflow-x-auto rounded-lg border border-border bg-surface-1">
				<!-- table-fixed + shared colgroup so every category table aligns identically. -->
				<table class="w-full table-fixed text-sm border-collapse">
					<colgroup>
						<col class="w-[22%]" /><!-- Olay -->
						<col class="w-[15%]" /><!-- Subcategory -->
						<col class="w-[9%]" /><!-- Mod -->
						<col class="w-[8%]" /><!-- Global -->
						<col class="w-[16%]" /><!-- Bu venue -->
						<col class="w-[30%]" /><!-- İpucu -->
					</colgroup>
					<thead>
						<tr class="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
							<th class="py-2 px-3 font-semibold">Olay</th>
							<th class="py-2 px-3 font-semibold">Subcategory</th>
							<th class="py-2 px-3 font-semibold">Mod</th>
							<th class="py-2 px-3 font-semibold">Global</th>
							<th class="py-2 px-3 font-semibold">Bu venue</th>
							<th class="py-2 px-3 font-semibold">İpucu</th>
						</tr>
					</thead>
					<tbody>
						{#each catRows as row (row.route_key)}
							<tr
								class="border-b border-border last:border-b-0 align-top
									{row.is_customized ? 'bg-brand-light/20' : ''}"
							>
								<td class="py-2 px-3">
									<div class="font-medium text-text-1 break-words">{row.route_label}</div>
									{#if row.is_customized}
										<span class="mt-0.5 inline-block text-[10px] font-medium text-brand-dark">● değiştirildi</span>
									{/if}
								</td>
								<td class="py-2 px-3 font-mono text-xs text-text-2 truncate">{row.subcategory}</td>
								<td class="py-2 px-3">
									<span
										class="inline-block px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap
											{MODE_STYLE[row.routing_mode] ?? 'bg-surface-2 text-text-2'}"
									>
										{MODE_LABEL[row.routing_mode] ?? row.routing_mode}
									</span>
								</td>
								<td class="py-2 px-3 font-mono text-xs text-text-3">{row.default_owner_key ?? '—'}</td>
								<td class="py-2 px-3">
									<div class="flex items-center gap-1.5">
										<select
											class="w-full min-w-0 px-2 py-1 text-xs rounded border border-border bg-surface-1
												text-text-1 focus:outline-none focus:ring-2 focus:ring-brand/30
												{!row.venue_owner_key || SYSTEM_BUCKETS.has(row.venue_owner_key) ? 'text-text-3 italic' : ''}"
											value={row.venue_owner_key ?? ''}
											onchange={(e) => onOwnerChange(row, e.currentTarget.value)}
										>
											<!-- Empty (infer_from_context): the LLM picks the owner from the excerpt.
											     Shown as a labelled placeholder instead of a blank box. -->
											{#if !row.venue_owner_key}
												<option value="" disabled selected>İlgili departman (metne göre)</option>
											{/if}
											{#each allowedOwners as o (o)}
												<option value={o}>{ownerLabel(o)}</option>
											{/each}
										</select>
										{#if saving[row.route_key] === 'saving'}
											<span class="text-[10px] text-text-3">…</span>
										{:else if saving[row.route_key] === 'saved'}
											<span class="text-[10px] text-success">✓</span>
										{:else if saving[row.route_key] === 'error'}
											<span class="text-[10px] text-danger">hata</span>
										{/if}
									</div>
								</td>
								<td class="py-2 px-3 text-xs text-text-2 break-words">{row.hint}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</div>
