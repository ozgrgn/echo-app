<!--
  ECHO /admin — superadmin venue/competitor/platform management (Talkwo team only;
  customer /settings stays read-only for Apify cost control).

  Flow: pick an OWNED venue (left) → toggle its platforms + enter its scraper refs
  (right) → manage competitors: attach/detach existing registry venues as watches,
  and enter each competitor's own platform refs. Platform selection lives on the
  owner and propagates to its competitors (effective set = union; backend computes).
-->
<script lang="ts">
	import { PLATFORM_REGISTRY, type Venue } from '@talkwo/echo-core';
	import {
		patchVenuePlatforms,
		patchVenueRefs,
		createWatch,
		deleteWatch,
		type PlatformRefs,
		type WatchRecord
	} from '@talkwo/echo-ui';
	import { auth } from '$lib/stores/auth.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const token = $derived(auth.token ?? '');
	const venues = $derived(data.venues as Venue[]);
	let watches = $state<WatchRecord[]>(data.watches as WatchRecord[]);

	const owned = $derived(venues.filter((v) => v.isOwned));
	const competitors = $derived(venues.filter((v) => !v.isOwned));
	const byId = $derived(new Map(venues.map((v) => [v.venueId, v])));

	// Selected owned venue (left panel).
	let selectedId = $state<string | null>(null);
	const selected = $derived(selectedId ? (byId.get(selectedId) ?? null) : null);

	// Local editable copy of the selected owner's platform selection.
	let sel = $state<Set<string>>(new Set());
	$effect(() => {
		// Re-seed local state whenever the selected venue changes.
		sel = new Set(selected?.watchedPlatforms ?? []);
	});

	const PLATFORM_KEYS = ['tripadvisor', 'google', 'holidaycheck', 'check24', 'booking'];

	// Watches whose owner is the selected venue → its competitors.
	const myWatches = $derived(
		selectedId ? watches.filter((w) => w.ownerVenueId === selectedId) : []
	);
	const myCompetitorIds = $derived(new Set(myWatches.map((w) => w.targetVenueId)));

	let saving = $state(false);
	let toast = $state<string | null>(null);
	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2500);
	}

	function togglePlatform(key: string) {
		const next = new Set(sel);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		sel = next;
	}

	async function savePlatforms() {
		if (!selectedId) return;
		saving = true;
		try {
			await patchVenuePlatforms(selectedId, { watchedPlatforms: [...sel].sort() }, token);
			flash('Platform seçimi kaydedildi');
			await invalidateAll();
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	// ── Per-venue platform refs (URL/ID) editing ──────────────────────────────
	let refsEditing = $state<string | null>(null); // venueId being edited
	let refsDraft = $state<PlatformRefs>({});

	function openRefs(v: Venue) {
		refsEditing = v.venueId;
		refsDraft = structuredClone($state.snapshot(v.platformRefs ?? {})) as PlatformRefs;
	}
	async function saveRefs() {
		if (!refsEditing) return;
		saving = true;
		try {
			await patchVenueRefs(refsEditing, refsDraft, token);
			flash('Platform bilgileri kaydedildi');
			refsEditing = null;
			await invalidateAll();
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	// ── Competitor watch attach/detach ────────────────────────────────────────
	let attachId = $state(''); // competitor venueId to attach
	async function attachCompetitor() {
		if (!selectedId || !attachId) return;
		saving = true;
		try {
			await createWatch(selectedId, attachId, token);
			watches = [
				...watches,
				{
					ownerVenueId: selectedId,
					targetVenueId: attachId,
					relation: 'competitor',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];
			attachId = '';
			flash('Rakip eklendi');
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}
	async function detachCompetitor(targetId: string) {
		if (!selectedId) return;
		saving = true;
		try {
			await deleteWatch(selectedId, targetId, token);
			watches = watches.filter((w) => !(w.ownerVenueId === selectedId && w.targetVenueId === targetId));
			flash('Rakip çıkarıldı');
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	// Competitors NOT yet watched by the selected owner (attach candidates).
	const attachable = $derived(competitors.filter((c) => !myCompetitorIds.has(c.venueId)));

	function refSummary(v: Venue | undefined): string {
		const keys = Object.keys(v?.platformRefs ?? {});
		return keys.length ? keys.join(', ') : 'eksik';
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<header class="mb-6">
		<h1 class="text-xl font-bold text-text-1">Yönetim — Venue & Rakip & Platform</h1>
		<p class="text-sm text-text-3 mt-1">
			Talkwo ekibi yönetir. Owned venue seç → platformlarını ve rakiplerini ayarla. Platform
			seçimi rakiplere otomatik yayılır (effective set = birleşim).
		</p>
	</header>

	<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
		<!-- ── Left: owned venue picker ──────────────────────────────── -->
		<aside class="bg-surface-1 border border-border rounded-lg p-3 h-fit">
			<h2 class="text-xs font-semibold uppercase tracking-wider text-text-3 px-2 mb-2">
				Owned Venue'ler ({owned.length})
			</h2>
			<ul class="space-y-1">
				{#each owned as v (v.venueId)}
					<li>
						<button
							class={[
								'w-full text-left px-3 py-2 rounded-md text-sm',
								selectedId === v.venueId
									? 'bg-brand text-white'
									: 'hover:bg-surface-2 text-text-1'
							]}
							onclick={() => (selectedId = v.venueId)}
						>
							<div class="font-medium truncate">{v.name}</div>
							<div class="text-xs opacity-70 truncate">{v.slug}</div>
						</button>
					</li>
				{/each}
				{#if owned.length === 0}
					<li class="text-xs text-text-3 px-2 py-4 text-center">Owned venue yok.</li>
				{/if}
			</ul>
		</aside>

		<!-- ── Right: selected owner detail ──────────────────────────── -->
		<main class="space-y-6">
			{#if !selected}
				<div class="bg-surface-1 border border-border rounded-lg p-12 text-center text-text-3">
					Soldan bir owned venue seçin.
				</div>
			{:else}
				<!-- Platform selection -->
				<section class="bg-surface-1 border border-border rounded-lg p-5">
					<header class="flex items-center justify-between mb-3">
						<div>
							<h2 class="font-semibold text-text-1">{selected.name} — Platformlar</h2>
							<p class="text-xs text-text-3">Seçilenler rakiplere de uygulanır.</p>
						</div>
						<button
							class="text-sm bg-brand text-white px-3 py-1.5 rounded-md disabled:opacity-50"
							onclick={savePlatforms}
							disabled={saving}
						>
							Kaydet
						</button>
					</header>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
						{#each PLATFORM_KEYS as key (key)}
							{@const p = PLATFORM_REGISTRY[key]}
							<label
								class={[
									'flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm',
									sel.has(key) ? 'bg-success-light/30 border-success/40' : 'border-border'
								]}
							>
								<input type="checkbox" checked={sel.has(key)} onchange={() => togglePlatform(key)} />
								<span>{p?.icon ?? '•'}</span>
								<span class="text-text-1">{p?.label ?? key}</span>
								{#if p?.status !== 'shipped'}
									<span class="text-[10px] text-warning ml-auto">yakında</span>
								{/if}
							</label>
						{/each}
					</div>
					<button
						class="text-xs text-brand hover:underline"
						onclick={() => openRefs(selected!)}
					>
						Bu venue'nun platform bilgilerini düzenle ({refSummary(selected)})
					</button>
				</section>

				<!-- Competitors -->
				<section class="bg-surface-1 border border-border rounded-lg p-5">
					<h2 class="font-semibold text-text-1 mb-3">Rakipler ({myWatches.length})</h2>

					<!-- attach -->
					<div class="flex gap-2 mb-4">
						<select bind:value={attachId} class="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-surface-2">
							<option value="">+ Rakip ekle (kayıtlı venue'lerden)…</option>
							{#each attachable as c (c.venueId)}
								<option value={c.venueId}>{c.name} ({c.slug})</option>
							{/each}
						</select>
						<button
							class="text-sm bg-brand text-white px-3 py-2 rounded-md disabled:opacity-50"
							onclick={attachCompetitor}
							disabled={saving || !attachId}
						>
							Ekle
						</button>
					</div>

					<!-- list -->
					<ul class="divide-y divide-border">
						{#each myWatches as w (w.targetVenueId)}
							{@const c = byId.get(w.targetVenueId)}
							<li class="py-3 flex items-center gap-3">
								<span class="text-xl">🏨</span>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-text-1 truncate">{c?.name ?? w.targetVenueId}</div>
									<div class="text-xs text-text-3">
										platform bilgisi: {refSummary(c)}
									</div>
								</div>
								{#if c}
									<button class="text-xs text-brand hover:underline" onclick={() => openRefs(c)}>
										bilgi gir
									</button>
								{/if}
								<button
									class="text-xs text-danger hover:underline"
									onclick={() => detachCompetitor(w.targetVenueId)}
									disabled={saving}
								>
									çıkar
								</button>
							</li>
						{/each}
						{#if myWatches.length === 0}
							<li class="py-6 text-center text-sm text-text-3">Henüz rakip eklenmemiş.</li>
						{/if}
					</ul>
				</section>
			{/if}
		</main>
	</div>
</div>

<!-- ── platformRefs editor modal ──────────────────────────────── -->
{#if refsEditing}
	{@const v = byId.get(refsEditing)}
	<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-1 rounded-lg p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
			<h3 class="font-semibold text-text-1 mb-1">Platform Bilgileri</h3>
			<p class="text-xs text-text-3 mb-4">{v?.name} — scraper için URL / ID</p>

			<div class="space-y-3 text-sm">
				<div>
					<label class="text-xs text-text-2">TripAdvisor locationId</label>
					<input
						type="number"
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2"
						value={refsDraft.tripadvisor?.locationId ?? ''}
						oninput={(e) => {
							const n = Number((e.target as HTMLInputElement).value);
							refsDraft.tripadvisor = { locationId: n, url: refsDraft.tripadvisor?.url ?? '' };
						}}
					/>
					<input
						type="text" placeholder="TripAdvisor URL"
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 mt-1"
						value={refsDraft.tripadvisor?.url ?? ''}
						oninput={(e) => {
							refsDraft.tripadvisor = { locationId: refsDraft.tripadvisor?.locationId ?? 0, url: (e.target as HTMLInputElement).value };
						}}
					/>
				</div>
				<div>
					<label class="text-xs text-text-2">Google (placeId / maps URL)</label>
					<input type="text" placeholder="maps URL"
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2"
						value={refsDraft.google?.url ?? ''}
						oninput={(e) => { refsDraft.google = { ...refsDraft.google, url: (e.target as HTMLInputElement).value }; }}
					/>
				</div>
				<div>
					<label class="text-xs text-text-2">HolidayCheck URL</label>
					<input type="text"
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2"
						value={refsDraft.holidaycheck?.url ?? ''}
						oninput={(e) => { refsDraft.holidaycheck = { url: (e.target as HTMLInputElement).value }; }}
					/>
				</div>
				<div>
					<label class="text-xs text-text-2">Booking URL</label>
					<input type="text"
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2"
						value={refsDraft.booking?.url ?? ''}
						oninput={(e) => { refsDraft.booking = { url: (e.target as HTMLInputElement).value }; }}
					/>
				</div>
			</div>

			<div class="flex justify-end gap-2 mt-5">
				<button class="text-sm px-3 py-1.5 text-text-2" onclick={() => (refsEditing = null)}>İptal</button>
				<button class="text-sm bg-brand text-white px-3 py-1.5 rounded-md disabled:opacity-50" onclick={saveRefs} disabled={saving}>Kaydet</button>
			</div>
		</div>
	</div>
{/if}

{#if toast}
	<div class="fixed bottom-6 right-6 bg-text-1 text-surface-1 px-4 py-2 rounded-md text-sm shadow-lg z-50">
		{toast}
	</div>
{/if}
