<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, listVenues, fetchTenant, getMySubscription, type Venue } from '@revora/review-core';
	import { auth } from '$lib/stores/auth.svelte';

	// Form state (Svelte 5 runes)
	let tenantKey = $state('');
	let clientSecret = $state('');
	let showSecret = $state(false);
	let error = $state('');
	let loading = $state(false);

	// Step state — credentials first, then venue picker if needed
	let step = $state<'credentials' | 'venue-picker'>('credentials');
	let venues = $state<Venue[]>([]);
	let selectedVenueSlug = $state<string | null>(null);

	// Pending state held between steps (NOT persisted)
	let pendingCreds: { tenantKey: string; clientSecret: string } | null = null;
	let pendingToken: { accessToken: string; expiresIn: number } | null = null;

	async function submitCredentials(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const creds = { tenantKey: tenantKey.trim(), clientSecret: clientSecret.trim() };
			const { accessToken, expiresIn } = await login(creds);

			// Fetch tenant + subscription cache (auth store needs this later)
			await fetchTenant(accessToken);

			// Filter to owned venues — competitors are not selectable as active venue
			const allVenues = await listVenues(accessToken);
			const owned = allVenues.filter((v) => v.isOwned);

			if (owned.length === 0) {
				error = "Tenant'ınıza otel kaydı yapılmamış. Talkwo ekibiyle iletişime geçin.";
				return;
			}

			if (owned.length === 1) {
				// Single-venue tenant — skip picker
				const venue = owned[0];
				auth.login(creds, accessToken, expiresIn, venue.slug, venue.name, getMySubscription());
				await goto('/dashboard');
				return;
			}

			// Multi-venue — show picker
			venues = owned;
			selectedVenueSlug = owned[0].slug;
			pendingCreds = creds;
			pendingToken = { accessToken, expiresIn };
			step = 'venue-picker';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Giriş başarısız.';
		} finally {
			loading = false;
		}
	}

	async function selectVenue() {
		if (!selectedVenueSlug || !pendingCreds || !pendingToken) return;
		const venue = venues.find((v) => v.slug === selectedVenueSlug)!;
		auth.login(
			pendingCreds,
			pendingToken.accessToken,
			pendingToken.expiresIn,
			venue.slug,
			venue.name,
			getMySubscription()
		);
		await goto('/dashboard');
	}

	function backToCredentials() {
		step = 'credentials';
		error = '';
		pendingCreds = null;
		pendingToken = null;
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-bg p-4">
	<div class="w-full max-w-md rounded-xl bg-surface-1 p-8 shadow-md border border-border">
		<header class="mb-6">
			<h1 class="text-2xl font-bold text-brand">Revora Panel</h1>
			<p class="text-sm text-text-2 mt-1">Yorum istihbaratı platformu</p>
		</header>

		{#if step === 'credentials'}
			<form onsubmit={submitCredentials} class="space-y-4">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Tenant Anahtarı</span>
					<input
						bind:value={tenantKey}
						class="w-full rounded-md border border-border px-3 py-2 bg-surface-1 text-text-1 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
						placeholder="TEN_LAGO_HOTELS"
						autocomplete="username"
						required
						disabled={loading}
					/>
				</label>

				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Client Secret</span>
					<div class="flex gap-2">
						<input
							bind:value={clientSecret}
							type={showSecret ? 'text' : 'password'}
							class="flex-1 rounded-md border border-border px-3 py-2 bg-surface-1 text-text-1 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
							placeholder="cs_..."
							autocomplete="current-password"
							required
							disabled={loading}
						/>
						<button
							type="button"
							onclick={() => (showSecret = !showSecret)}
							class="rounded-md border border-border px-3 hover:bg-surface-2 text-text-2"
							aria-label={showSecret ? 'Gizle' : 'Göster'}
							disabled={loading}
						>
							{showSecret ? '🙈' : '👁'}
						</button>
					</div>
					<small class="mt-1 block text-xs text-text-3">
						Bu sır size bir kez verilir. Kaybederseniz Talkwo ekibinden yeni bir sır talep
						edin.
					</small>
				</label>

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
				>
					{loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
				</button>

				<p class="text-xs text-text-3 text-center pt-2">
					Mock modda: herhangi bir değer girin, giriş başarılı sayılır.
				</p>
			</form>
		{:else}
			<div class="space-y-4">
				<p class="text-sm text-text-2">Hangi otelinizi izlemek istersiniz?</p>
				<div class="space-y-2">
					{#each venues as venue (venue.slug)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-light/30"
						>
							<input
								type="radio"
								name="venue"
								value={venue.slug}
								bind:group={selectedVenueSlug}
								class="text-brand"
							/>
							<div class="flex-1">
								<div class="font-medium text-text-1">{venue.name}</div>
								<div class="text-xs text-text-3">{venue.region?.area ?? ''}</div>
							</div>
						</label>
					{/each}
				</div>

				<button
					onclick={selectVenue}
					class="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark transition-colors"
				>
					Devam
				</button>

				<button
					onclick={backToCredentials}
					type="button"
					class="block w-full text-center text-sm text-text-3 hover:text-text-2"
				>
					← Farklı bir tenant ile giriş yap
				</button>
			</div>
		{/if}
	</div>
</div>
