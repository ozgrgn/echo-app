<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();

	let showSecret = $state(false);
	let loading = $state(false);
	let selectedVenueSlug = $state<string | null>(null);

	// When the credentials action returns the picker, seed the radio selection.
	$effect(() => {
		if (form?.step === 'venue-picker' && form.venues?.length && !selectedVenueSlug) {
			selectedVenueSlug = form.venues[0].slug;
		}
	});

	let error = $derived(form?.error ?? '');
</script>

<div class="flex min-h-screen items-center justify-center bg-bg p-4">
	<div class="w-full max-w-md rounded-xl bg-surface-1 p-8 shadow-md border border-border">
		<header class="mb-6">
			<h1 class="text-2xl font-bold text-brand">ECHO Panel</h1>
			<p class="text-sm text-text-2 mt-1">Yorum istihbaratı platformu</p>
		</header>

		{#if form?.step !== 'venue-picker'}
			<form
				method="POST"
				action="?/credentials"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update({ reset: false });
						loading = false;
					};
				}}
				class="space-y-4"
			>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Tenant Anahtarı</span>
					<input
						name="tenantKey"
						value={form?.tenantKey ?? ''}
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
							name="clientSecret"
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
						Bu sır size bir kez verilir. Kaybederseniz Talkwo ekibinden yeni bir sır talep edin.
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
			</form>
		{:else}
			<form
				method="POST"
				action="?/selectVenue"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="space-y-4"
			>
				<p class="text-sm text-text-2">Hangi otelinizi izlemek istersiniz?</p>
				<input type="hidden" name="venueSlug" value={selectedVenueSlug ?? ''} />
				<input
					type="hidden"
					name="venueName"
					value={form.venues.find((v: { slug: string }) => v.slug === selectedVenueSlug)?.name ?? ''}
				/>
				<div class="space-y-2">
					{#each form.venues as venue (venue.slug)}
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
								<div class="text-xs text-text-3">{venue.area}</div>
							</div>
						</label>
					{/each}
				</div>

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
				>
					{loading ? 'Yönlendiriliyor…' : 'Devam'}
				</button>

				<a href="/login" class="block w-full text-center text-sm text-text-3 hover:text-text-2">
					← Farklı bir tenant ile giriş yap
				</a>
			</form>
		{/if}
	</div>
</div>
