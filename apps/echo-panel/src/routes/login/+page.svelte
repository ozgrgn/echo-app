<script lang="ts">
	import { enhance } from '$app/forms';
	import { dev } from '$app/environment';

	let { form } = $props();

	// 'otp' is the primary flow; the legacy clientSecret form stays reachable
	// during the transition (panelAuth is slated for removal once OTP settles).
	let mode = $state<'otp' | 'secret'>('otp');

	let showSecret = $state(false);
	let loading = $state(false);
	let selectedVenueSlug = $state<string | null>(null);
	let selectedOtpVenue = $state<string | null>(null); // `${tenantKey}::${venueSlug}`

	// Resend cooldown for the OTP code step.
	let resendIn = $state(0);
	let resendTimer: ReturnType<typeof setInterval> | null = null;
	function startResendCooldown(seconds = 60) {
		resendIn = seconds;
		if (resendTimer) clearInterval(resendTimer);
		resendTimer = setInterval(() => {
			resendIn -= 1;
			if (resendIn <= 0 && resendTimer) clearInterval(resendTimer);
		}, 1000);
	}

	$effect(() => {
		if (form?.step === 'otp-code') startResendCooldown();
	});

	// Seed pickers when their step arrives.
	$effect(() => {
		if (form?.step === 'venue-picker' && form.venues?.length && !selectedVenueSlug) {
			selectedVenueSlug = form.venues[0].slug;
		}
		if (form?.step === 'otp-venue' && form.otpVenues?.length && !selectedOtpVenue) {
			const v = form.otpVenues[0];
			selectedOtpVenue = `${v.tenantKey}::${v.venueSlug}`;
		}
	});

	let error = $derived(form?.error ?? '');
	let step = $derived(form?.step ?? null);

	const inputCls =
		'w-full rounded-md border border-border px-3 py-2 bg-surface-1 text-text-1 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
	const buttonCls =
		'w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors';

	const submitEnhance = () => {
		loading = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			loading = false;
		};
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-bg p-4">
	<div class="w-full max-w-md rounded-xl bg-surface-1 p-8 shadow-md border border-border">
		<header class="mb-6">
			<h1 class="text-2xl font-bold text-brand">ECHO Panel</h1>
			<p class="text-sm text-text-2 mt-1">Yorum istihbaratı platformu</p>
		</header>

		{#if step === 'otp-code'}
			<!-- ── OTP step 2: the SMS code ─────────────────────────────────────── -->
			<form method="POST" action="?/otpVerify" use:enhance={submitEnhance} class="space-y-4">
				<p class="text-sm text-text-2">
					<strong class="text-text-1">{form?.phone}</strong> numarasına gönderilen 6 haneli kodu girin.
				</p>
				<input type="hidden" name="phone" value={form?.phone ?? ''} />
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Doğrulama Kodu</span>
					<input
						name="otp"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength="6"
						pattern="[0-9]*"
						class="{inputCls} text-center text-xl tracking-[0.5em]"
						placeholder="••••••"
						required
						disabled={loading}
					/>
				</label>

				{#if form?.devOtp}
					<p class="rounded-md border border-dashed border-warning/40 bg-warning-light/20 px-3 py-2 text-xs text-text-3">
						Dev kodu: <code class="font-mono">{form.devOtp}</code>
					</p>
				{/if}

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class={buttonCls}>
					{loading ? 'Doğrulanıyor…' : 'Doğrula'}
				</button>
			</form>

			<!-- Resend lives in its own form: same otpRequest action, same phone. -->
			<form method="POST" action="?/otpRequest" use:enhance={submitEnhance} class="mt-3">
				<input type="hidden" name="phone" value={form?.phone ?? ''} />
				<button
					type="submit"
					disabled={loading || resendIn > 0}
					class="w-full text-center text-sm text-text-3 hover:text-text-2 disabled:opacity-50"
				>
					{resendIn > 0 ? `Tekrar gönder (${resendIn}s)` : 'Kodu tekrar gönder'}
				</button>
			</form>

			<a href="/login" class="mt-2 block w-full text-center text-sm text-text-3 hover:text-text-2">
				← Farklı bir numarayla giriş yap
			</a>
		{:else if step === 'otp-venue'}
			<!-- ── OTP step 3: venue picker (multi-venue staff) ─────────────────── -->
			<form method="POST" action="?/otpSelectVenue" use:enhance={submitEnhance} class="space-y-4">
				<p class="text-sm text-text-2">
					{form?.userName ? `Merhaba ${form.userName} — hangi` : 'Hangi'} otelinizi izlemek istersiniz?
				</p>
				<input type="hidden" name="tenantKey" value={selectedOtpVenue?.split('::')[0] ?? ''} />
				<input type="hidden" name="venueSlug" value={selectedOtpVenue?.split('::')[1] ?? ''} />
				<div class="space-y-2">
					{#each form?.otpVenues ?? [] as venue (`${venue.tenantKey}::${venue.venueSlug}`)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-light/30"
						>
							<input
								type="radio"
								name="venue"
								value={`${venue.tenantKey}::${venue.venueSlug}`}
								bind:group={selectedOtpVenue}
								class="text-brand"
							/>
							<div class="flex-1">
								<div class="font-medium text-text-1">{venue.venueName}</div>
								{#if venue.department || venue.role}
									<div class="text-xs text-text-3">
										{[venue.role, venue.department].filter(Boolean).join(' · ')}
									</div>
								{/if}
							</div>
						</label>
					{/each}
				</div>

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class={buttonCls}>
					{loading ? 'Yönlendiriliyor…' : 'Devam'}
				</button>

				<a href="/login" class="block w-full text-center text-sm text-text-3 hover:text-text-2">
					← Baştan giriş yap
				</a>
			</form>
		{:else if step === 'venue-picker'}
			<!-- ── LEGACY venue picker (clientSecret flow) ──────────────────────── -->
			<form method="POST" action="?/selectVenue" use:enhance={submitEnhance} class="space-y-4">
				<p class="text-sm text-text-2">Hangi otelinizi izlemek istersiniz?</p>
				<input type="hidden" name="venueSlug" value={selectedVenueSlug ?? ''} />
				<input
					type="hidden"
					name="venueName"
					value={form?.venues?.find((v) => v.slug === selectedVenueSlug)?.name ?? ''}
				/>
				<div class="space-y-2">
					{#each form?.venues ?? [] as venue (venue.slug)}
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

				<button type="submit" disabled={loading} class={buttonCls}>
					{loading ? 'Yönlendiriliyor…' : 'Devam'}
				</button>

				<a href="/login" class="block w-full text-center text-sm text-text-3 hover:text-text-2">
					← Farklı bir tenant ile giriş yap
				</a>
			</form>
		{:else if mode === 'otp'}
			<!-- ── OTP step 1: phone (PRIMARY login) ────────────────────────────── -->
			<form method="POST" action="?/otpRequest" use:enhance={submitEnhance} class="space-y-4">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Cep Telefonu</span>
					<input
						name="phone"
						type="tel"
						value={form?.phone ?? ''}
						class={inputCls}
						placeholder="05XX XXX XX XX"
						autocomplete="tel"
						required
						disabled={loading}
					/>
					<small class="mt-1 block text-xs text-text-3">
						Kayıtlı cep telefonunuza SMS ile tek kullanımlık kod gönderilir.
					</small>
				</label>

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class={buttonCls}>
					{loading ? 'Kod gönderiliyor…' : 'Kod Gönder'}
				</button>
			</form>

			<button
				type="button"
				onclick={() => (mode = 'secret')}
				class="mt-4 block w-full text-center text-sm text-text-3 hover:text-text-2"
			>
				Client secret ile giriş →
			</button>
		{:else}
			<!-- ── LEGACY: tenantKey + clientSecret (transition-only) ───────────── -->
			<form method="POST" action="?/credentials" use:enhance={submitEnhance} class="space-y-4">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-1">Tenant Anahtarı</span>
					<input
						name="tenantKey"
						value={form?.tenantKey ?? ''}
						class={inputCls}
						placeholder="TEN_..."
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

				{#if dev}
					<!-- DEV hint: superadmin (Yönetim) is granted server-side, not via this
					     form — add the tenantKey to PANEL_DEV_SUPERADMIN_TENANTS in the
					     backend .env (NODE_ENV=development). Real prod path is OTP login. -->
					<p class="rounded-md border border-dashed border-warning/40 bg-warning-light/20 px-3 py-2 text-xs text-text-3">
						Dev: Yönetim'i görmek için bu tenant'ı backend <code>.env</code>'inde
						<code>PANEL_DEV_SUPERADMIN_TENANTS</code>'e ekle.
					</p>
				{/if}

				{#if error}
					<p class="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class={buttonCls}>
					{loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
				</button>
			</form>

			<button
				type="button"
				onclick={() => (mode = 'otp')}
				class="mt-4 block w-full text-center text-sm text-text-3 hover:text-text-2"
			>
				← Telefonla (OTP) giriş
			</button>
		{/if}
	</div>
</div>
