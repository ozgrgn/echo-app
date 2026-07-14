<script lang="ts">
	import type { VenueGranularRow } from '@talkwo/echo-ui';

	let { data } = $props();

	// Live editable copy of the merged rows (keyed by granular_key). Seeded once from the
	// load data; each row is replaced in place on save/reset with the server's canonical row.
	let rows = $state<VenueGranularRow[]>([...data.catalog.rows]);
	const allowedOwners = $derived(data.catalog.allowed_owners);

	// System buckets render distinctly in the dropdown (not real departments).
	const SYSTEM_BUCKETS = new Set(['w0', 'external', 'manual_review']);

	// ── Filters ──────────────────────────────────────────────────────────────
	// v2: no routing mode. Filter by score_policy + critical + overridden.
	type Filter =
		| 'all'
		| 'department_score'
		| 'no_score'
		| 'external_report'
		| 'manual_review'
		| 'critical'
		| 'changed';
	let policyFilter = $state<Filter>('all');
	let search = $state('');

	const POLICY_LABEL: Record<string, string> = {
		department_score: 'Skorlanır',
		no_score: 'Skorsuz',
		external_report: 'Dış rapor',
		manual_review: 'Elle inceleme'
	};
	const POLICY_STYLE: Record<string, string> = {
		department_score: 'bg-brand-light text-brand-dark',
		no_score: 'bg-surface-2 text-text-3',
		external_report: 'bg-surface-3 text-text-2',
		manual_review: 'bg-surface-2 text-text-2'
	};

	const filters: { key: Filter; label: string }[] = [
		{ key: 'all', label: 'Tümü' },
		{ key: 'department_score', label: 'Skorlanır' },
		{ key: 'no_score', label: 'Skorsuz' },
		{ key: 'external_report', label: 'Dış rapor' },
		{ key: 'manual_review', label: 'Elle inceleme' },
		{ key: 'critical', label: 'Kritik' },
		{ key: 'changed', label: 'Değiştirilmiş' }
	];

	// A row is "overridden" when the venue reassigned its owner (owner_source).
	function isOverridden(r: VenueGranularRow): boolean {
		return r.owner_source === 'venue_override';
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLocaleLowerCase('tr');
		return rows.filter((r) => {
			if (policyFilter === 'changed') {
				if (!isOverridden(r)) return false;
			} else if (policyFilter === 'critical') {
				if (r.alert_policy !== 'critical_alert') return false;
			} else if (policyFilter !== 'all' && r.score_policy !== policyFilter) {
				return false;
			}
			if (!q) return true;
			return (
				r.label_tr.toLocaleLowerCase('tr').includes(q) ||
				r.granular_key.toLowerCase().includes(q) ||
				r.parent_key.toLowerCase().includes(q) ||
				r.effective_owner_key.toLowerCase().includes(q)
			);
		});
	});

	// Group the filtered rows by category (stable order = first appearance).
	const grouped = $derived.by(() => {
		const map = new Map<string, VenueGranularRow[]>();
		for (const r of filtered) {
			const list = map.get(r.category) ?? [];
			list.push(r);
			map.set(r.category, list);
		}
		return [...map.entries()];
	});

	const changedCount = $derived(rows.filter(isOverridden).length);

	// ── Per-row save / reset ─────────────────────────────────────────────────────
	// Track state per granular_key so each row shows its own status.
	let saving = $state<Record<string, 'saving' | 'saved' | 'error'>>({});

	function flash(key: string, state: 'saved') {
		saving = { ...saving, [key]: state };
		setTimeout(() => {
			const { [key]: _, ...rest } = saving;
			saving = rest;
		}, 1500);
	}

	async function saveOwner(row: VenueGranularRow, ownerKey: string) {
		if (ownerKey === row.effective_owner_key) return;
		saving = { ...saving, [row.granular_key]: 'saving' };
		try {
			const res = await fetch('/api/owner-routing', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ granularKey: row.granular_key, patch: { owner_key: ownerKey } })
			});
			if (!res.ok) throw new Error(String(res.status));
			const { row: updated } = (await res.json()) as { row: VenueGranularRow };
			rows = rows.map((r) => (r.granular_key === updated.granular_key ? updated : r));
			flash(row.granular_key, 'saved');
		} catch {
			saving = { ...saving, [row.granular_key]: 'error' };
		}
	}

	// Reset a row to its catalog default owner (DELETE the venue override).
	async function resetOwner(row: VenueGranularRow) {
		saving = { ...saving, [row.granular_key]: 'saving' };
		try {
			const res = await fetch('/api/owner-routing', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ granularKey: row.granular_key })
			});
			if (!res.ok) throw new Error(String(res.status));
			const { row: updated } = (await res.json()) as { row: VenueGranularRow };
			rows = rows.map((r) => (r.granular_key === updated.granular_key ? updated : r));
			flash(row.granular_key, 'saved');
		} catch {
			saving = { ...saving, [row.granular_key]: 'error' };
		}
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
		<h1 class="text-xl font-semibold text-text-1">Departman Yönlendirme Ayarları</h1>
		<p class="mt-1 text-sm text-text-2">
			Her granular konunun bu otelde hangi departmana ait olduğunu belirleyin.
			<span class="text-text-3">
				Yalnızca <em>departman</em> değiştirilebilir; skorlama türü, alarm ve kritik sınıflandırması
				global katalogdan gelir (salt-okunur). Varsayılana dönmek için <em>Sıfırla</em>'yı kullanın.
			</span>
		</p>
		<p class="mt-1 text-xs text-text-3">
			{data.venueName} · {rows.length} konu · {changedCount} değiştirilmiş · katalog {data.catalog.catalog_version}
		</p>
	</header>

	<!-- Filters + search -->
	<div class="flex flex-wrap items-center gap-2">
		{#each filters as f (f.key)}
			<button
				class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
					{policyFilter === f.key
						? 'bg-brand text-white border-brand'
						: 'bg-surface-1 text-text-2 border-border hover:text-text-1'}"
				onclick={() => (policyFilter = f.key)}
			>
				{f.label}{#if f.key === 'changed' && changedCount > 0}&nbsp;({changedCount}){/if}
			</button>
		{/each}
		<input
			type="search"
			bind:value={search}
			placeholder="Ara: konu, granular_key, departman…"
			class="ml-auto w-64 max-w-full px-3 py-1.5 text-sm rounded-md border border-border bg-surface-1
				text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
		/>
	</div>

	{#if filtered.length === 0}
		<p class="py-12 text-center text-sm text-text-3">Bu filtreyle eşleşen konu yok.</p>
	{/if}

	{#each grouped as [category, catRows] (category)}
		<section>
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">{category}</h2>
			<div class="overflow-x-auto rounded-lg border border-border bg-surface-1">
				<!-- table-fixed + shared colgroup so every category table aligns identically. -->
				<table class="w-full table-fixed text-sm border-collapse">
					<colgroup>
						<col class="w-[24%]" /><!-- Konu -->
						<col class="w-[16%]" /><!-- granular_key -->
						<col class="w-[11%]" /><!-- Skorlama -->
						<col class="w-[8%]" /><!-- Global -->
						<col class="w-[22%]" /><!-- Bu venue -->
						<col class="w-[19%]" /><!-- Açıklama -->
					</colgroup>
					<thead>
						<tr class="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
							<th class="py-2 px-3 font-semibold">Konu</th>
							<th class="py-2 px-3 font-semibold">granular_key</th>
							<th class="py-2 px-3 font-semibold">Skorlama</th>
							<th class="py-2 px-3 font-semibold">Global</th>
							<th class="py-2 px-3 font-semibold">Bu venue</th>
							<th class="py-2 px-3 font-semibold">Açıklama</th>
						</tr>
					</thead>
					<tbody>
						{#each catRows as row (row.granular_key)}
							<tr
								class="border-b border-border last:border-b-0 align-top
									{isOverridden(row) ? 'bg-brand-light/20' : ''}"
							>
								<td class="py-2 px-3">
									<div class="font-medium text-text-1 break-words">{row.label_tr}</div>
									<div class="mt-0.5 flex flex-wrap items-center gap-1">
										{#if isOverridden(row)}
											<span class="text-[10px] font-medium text-brand-dark">● değiştirildi</span>
										{/if}
										{#if row.alert_policy === 'critical_alert'}
											<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-light text-danger" title={row.critical_flags.join(', ')}>
												kritik
											</span>
										{/if}
									</div>
								</td>
								<td class="py-2 px-3 font-mono text-xs text-text-2 truncate" title={row.parent_key}>{row.granular_key}</td>
								<td class="py-2 px-3">
									<span
										class="inline-block px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap
											{POLICY_STYLE[row.score_policy] ?? 'bg-surface-2 text-text-2'}"
										title="skorlama türü global katalogdan gelir (salt-okunur)"
									>
										{POLICY_LABEL[row.score_policy] ?? row.score_policy}
									</span>
								</td>
								<td class="py-2 px-3 font-mono text-xs text-text-3">{row.default_owner_key}</td>
								<td class="py-2 px-3">
									<div class="flex items-center gap-1.5">
										<select
											class="w-full min-w-0 px-2 py-1 text-xs rounded border border-border bg-surface-1
												text-text-1 focus:outline-none focus:ring-2 focus:ring-brand/30
												{SYSTEM_BUCKETS.has(row.effective_owner_key) ? 'text-text-3 italic' : ''}"
											value={row.effective_owner_key}
											onchange={(e) => saveOwner(row, e.currentTarget.value)}
										>
											{#each allowedOwners as o (o)}
												<option value={o}>{ownerLabel(o)}</option>
											{/each}
										</select>
										{#if isOverridden(row)}
											<button
												class="text-[10px] text-text-3 hover:text-text-1 whitespace-nowrap"
												title="varsayılan departmana ({row.default_owner_key}) dön"
												onclick={() => resetOwner(row)}
											>
												sıfırla
											</button>
										{/if}
										{#if saving[row.granular_key] === 'saving'}
											<span class="text-[10px] text-text-3">…</span>
										{:else if saving[row.granular_key] === 'saved'}
											<span class="text-[10px] text-success">✓</span>
										{:else if saving[row.granular_key] === 'error'}
											<span class="text-[10px] text-danger">hata</span>
										{/if}
									</div>
								</td>
								<td class="py-2 px-3 text-xs text-text-2 break-words">{row.description_tr}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</div>
