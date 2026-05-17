<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { PLATFORM_REGISTRY } from '@revora/review-core';

	let { data } = $props();

	let activeTab = $state('profile');

	// ── Notifications form state (local-only Phase 1; PATCH endpoint in Phase 2) ──
	interface NotificationsState {
		emails: string[];
		whatsappNumbers: string[];
		channels: { email: boolean; whatsapp: boolean; inApp: boolean };
		weeklyDigest: { enabled: boolean; dayOfWeek: number; sendHour: number };
		monthlyDigest: { enabled: boolean; dayOfMonth: number };
		anomalyGpiDrop: { enabled: boolean; windowDays: number; pointsThreshold: number };
		anomalyNegSpike: { enabled: boolean; windowHours: number; minCount: number };
		anomalyRpiDrop: { enabled: boolean };
		quietHoursEnabled: boolean;
	}

	let notifications = $state<NotificationsState>({
		emails: ['ozgur@talkwo.com'],
		whatsappNumbers: [],
		channels: { email: true, whatsapp: false, inApp: true },
		weeklyDigest: { enabled: true, dayOfWeek: 1, sendHour: 9 },
		monthlyDigest: { enabled: true, dayOfMonth: 1 },
		anomalyGpiDrop: { enabled: true, windowDays: 7, pointsThreshold: 3 },
		anomalyNegSpike: { enabled: true, windowHours: 24, minCount: 5 },
		anomalyRpiDrop: { enabled: false },
		quietHoursEnabled: false
	});

	let newEmail = $state('');
	function addEmail() {
		const email = newEmail.trim();
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
		if (notifications.emails.includes(email)) return;
		notifications.emails = [...notifications.emails, email];
		newEmail = '';
	}
	function removeEmail(email: string) {
		notifications.emails = notifications.emails.filter((e) => e !== email);
	}

	let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');
	async function saveNotifications() {
		saveStatus = 'saving';
		// TODO Phase 2: PATCH /v1/tenants/me/settings { notifications }
		await new Promise((r) => setTimeout(r, 400));
		saveStatus = 'saved';
		setTimeout(() => (saveStatus = 'idle'), 2000);
	}

	const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

	// ── Subscription limits / features for display ──
	const sub = $derived(data.subscription);
	const competitorLimit = $derived(sub?.limits.competitors ?? 0);
	const platformLimit = $derived(sub?.limits.platforms ?? 1);
	const responseDraftsLimit = $derived(sub?.limits.responseDraftsPerMonth ?? 0);

	const tabs = [
		{ value: 'profile', label: 'Otel Profili', icon: '🏨' },
		{ value: 'platforms', label: 'Platformlar', icon: '🔌' },
		{ value: 'competitors', label: 'Rakipler', icon: '🏆' },
		{ value: 'notifications', label: 'Bildirimler', icon: '🔔' }
	];
</script>

<div class="space-y-6">
	<header>
		<p class="text-sm text-text-2">
			Tenant: <code class="font-mono text-text-1">{data.tenantKey}</code>
			{#if sub}
				<span class="ml-2 px-2 py-0.5 rounded bg-brand-light text-brand text-xs font-medium uppercase">
					Revora {sub.tier}
				</span>
			{/if}
		</p>
	</header>

	<Tabs.Root bind:value={activeTab} class="flex flex-col gap-6">
		<!-- Tab list -->
		<Tabs.List
			class="flex items-center gap-1 border-b border-border overflow-x-auto"
		>
			{#each tabs as t (t.value)}
				<Tabs.Trigger
					value={t.value}
					class="px-4 py-2.5 text-sm font-medium text-text-2 border-b-2 border-transparent data-[state=active]:text-brand data-[state=active]:border-brand hover:text-text-1 transition-colors whitespace-nowrap"
				>
					<span class="mr-1.5">{t.icon}</span>{t.label}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		<!-- ── Profile tab ─────────────────────────────────────────────── -->
		<Tabs.Content value="profile" class="space-y-4">
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
				<h2 class="text-base font-semibold text-text-1 mb-4">Otel Bilgileri (Salt-Okunur)</h2>
				{#if data.ownVenue}
					<dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
						<div>
							<dt class="text-xs text-text-3 uppercase tracking-wider mb-1">Otel Adı</dt>
							<dd class="text-text-1 font-medium">{data.ownVenue.name}</dd>
						</div>
						<div>
							<dt class="text-xs text-text-3 uppercase tracking-wider mb-1">Slug</dt>
							<dd class="text-text-1 font-mono text-xs">{data.ownVenue.slug}</dd>
						</div>
						<div>
							<dt class="text-xs text-text-3 uppercase tracking-wider mb-1">Bölge</dt>
							<dd class="text-text-1">
								{#if data.ownVenue.region}
									{data.ownVenue.region.area}, {data.ownVenue.region.district},
									{data.ownVenue.region.province}
								{:else}—{/if}
							</dd>
						</div>
						<div>
							<dt class="text-xs text-text-3 uppercase tracking-wider mb-1">Saat Dilimi</dt>
							<dd class="text-text-1 font-mono">{data.ownVenue.tz ?? '—'}</dd>
						</div>
					</dl>
					<div class="mt-4 text-xs text-text-3">
						Otel profili güncellemeleri için Talkwo ekibiyle iletişime geçin.
					</div>
				{:else}
					<p class="text-sm text-text-3">Otel bilgisi yüklenemedi.</p>
				{/if}
			</section>
		</Tabs.Content>

		<!-- ── Platforms tab ──────────────────────────────────────────── -->
		<Tabs.Content value="platforms" class="space-y-4">
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
				<header class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-base font-semibold text-text-1">Yorum Platformları</h2>
						<p class="text-xs text-text-3 mt-1">
							{Object.keys(data.ownVenue?.platforms ?? {}).length} / {platformLimit} platforma
							abonesiniz
						</p>
					</div>
				</header>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each Object.values(PLATFORM_REGISTRY) as p (p.key)}
						{@const isLive = p.status === 'shipped'}
						{@const isSubscribed = data.ownVenue?.platforms?.[p.key] !== undefined}
						<article
							class={[
								'border rounded-lg p-4 flex items-start gap-3',
								isSubscribed
									? 'bg-success-light/30 border-success/30'
									: 'bg-surface-2/30 border-border'
							]}
						>
							<span class="text-3xl shrink-0">{p.icon}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h3 class="font-semibold text-text-1">{p.label}</h3>
									<span
										class={[
											'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
											p.status === 'shipped'
												? 'bg-success text-white'
												: p.status === 'beta'
													? 'bg-warning text-white'
													: 'bg-text-3/20 text-text-2'
										]}
									>
										{p.status === 'shipped' ? 'Aktif' : p.status === 'beta' ? 'Beta' : 'Yakında'}
									</span>
								</div>
								{#if isSubscribed}
									<p class="text-xs text-success">✓ Aboneliğiniz var</p>
								{:else if isLive}
									<p class="text-xs text-text-2">
										<a href="#contact" class="text-brand hover:underline">Aboneliğe ekle</a> →
										fiyat teklifi için iletişime geçin
									</p>
								{:else}
									<p class="text-xs text-text-3">
										Bu platform yakında devreye alınacak.
									</p>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		</Tabs.Content>

		<!-- ── Competitors tab ────────────────────────────────────────── -->
		<Tabs.Content value="competitors" class="space-y-4">
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm">
				<header class="mb-4 flex items-center justify-between flex-wrap gap-2">
					<div>
						<h2 class="text-base font-semibold text-text-1">İzlenen Rakipler</h2>
						<p class="text-xs text-text-3 mt-1">
							<span class="font-mono">{data.competitors.length}</span> / <span class="font-mono">{competitorLimit}</span> rakip izleniyor
						</p>
					</div>
				</header>

				<!-- Read-only CTA banner -->
				<div class="bg-brand-light/30 border border-brand-light rounded-md p-4 text-sm text-text-2 mb-4">
					<div class="flex items-start gap-3">
						<span class="text-xl shrink-0">ℹ️</span>
						<div>
							<strong class="text-text-1">Rakip listesi Talkwo ekibi tarafından yönetilir.</strong>
							Rakip eklemek/çıkarmak için
							<a href="mailto:hello@revora.io" class="text-brand hover:underline">
								hello@revora.io
							</a>
							adresinden iletişime geçin. Bu kontrol, fiyatlandırma ve Apify maliyet yönetimi
							için merkezi tutulmaktadır.
						</div>
					</div>
				</div>

				{#if competitorLimit === 0}
					<div class="bg-surface-2 rounded-md p-6 text-center">
						<div class="text-3xl mb-2">🏆</div>
						<div class="font-medium text-text-1 mb-1">Rakip izleme aktif değil</div>
						<div class="text-sm text-text-2 mb-3">
							Lite paketinde rakip izleme bulunmuyor. Pro veya Enterprise paketine geçerek 5+
							rakibinizi izlemeye başlayın.
						</div>
						<a href="mailto:hello@revora.io" class="inline-block text-sm text-brand hover:underline">
							Paket yükseltme →
						</a>
					</div>
				{:else if data.competitors.length === 0}
					<p class="text-sm text-text-3 text-center py-8">
						Henüz rakip eklenmemiş. Talkwo ekibiyle iletişime geçin.
					</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each data.competitors as c (c.slug)}
							<li class="py-3 flex items-center gap-3">
								<span class="text-2xl shrink-0">🏨</span>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-text-1">{c.name}</div>
									<div class="text-xs text-text-3">
										{data.competitorRegions[c.slug] ?? c.region?.area ?? '—'}
									</div>
								</div>
								<div class="text-right text-xs text-text-3">
									<div>{Object.keys(c.platforms).length} platform</div>
									<div class="font-mono">
										son güncelleme: {new Date(c.updatedAt).toLocaleDateString('tr-TR')}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</Tabs.Content>

		<!-- ── Notifications tab ──────────────────────────────────────── -->
		<Tabs.Content value="notifications" class="space-y-4">
			<!-- Channels section -->
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm space-y-5">
				<header>
					<h2 class="text-base font-semibold text-text-1">Bildirim Kanalları</h2>
					<p class="text-xs text-text-3 mt-1">
						Hangi kanaldan bildirim almak istediğinizi seçin.
					</p>
				</header>

				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<label
						class="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-light/30"
					>
						<input type="checkbox" bind:checked={notifications.channels.email} class="rounded text-brand" />
						<div>
							<div class="font-medium text-sm">📧 E-posta</div>
							<div class="text-xs text-text-3">Anlık + özet</div>
						</div>
					</label>
					<label
						class="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-light/30"
					>
						<input type="checkbox" bind:checked={notifications.channels.whatsapp} class="rounded text-brand" />
						<div>
							<div class="font-medium text-sm">💬 WhatsApp</div>
							<div class="text-xs text-text-3">Talwo entegrasyonu üzerinden</div>
						</div>
					</label>
					<label
						class="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-light/30"
					>
						<input type="checkbox" bind:checked={notifications.channels.inApp} class="rounded text-brand" />
						<div>
							<div class="font-medium text-sm">🔔 Uygulama içi</div>
							<div class="text-xs text-text-3">Panel sağ üst</div>
						</div>
					</label>
				</div>

				<!-- Email recipients -->
				<div>
					<div class="block text-sm font-medium text-text-1 mb-2">
						E-posta alıcıları ({notifications.emails.length})
					</div>
					<div class="flex flex-wrap gap-2 mb-2">
						{#each notifications.emails as email (email)}
							<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 text-sm">
								{email}
								<button
									onclick={() => removeEmail(email)}
									class="text-text-3 hover:text-danger"
									aria-label="Kaldır"
								>
									✕
								</button>
							</span>
						{/each}
					</div>
					<div class="flex gap-2">
						<input
							bind:value={newEmail}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
							type="email"
							placeholder="ornek@otelinizin-domain.com"
							class="flex-1 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
						/>
						<button
							onclick={addEmail}
							class="px-4 py-1.5 rounded-md bg-brand text-white text-sm hover:bg-brand-dark"
						>
							+ Ekle
						</button>
					</div>
				</div>
			</section>

			<!-- Digests -->
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm space-y-4">
				<header>
					<h2 class="text-base font-semibold text-text-1">Düzenli Raporlar</h2>
				</header>

				<label class="flex items-start gap-3 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={notifications.weeklyDigest.enabled}
						class="rounded text-brand mt-1"
					/>
					<div class="flex-1">
						<div class="font-medium text-sm">Haftalık Özet</div>
						<div class="text-xs text-text-3 mb-2">
							Her hafta GPI/RPI trend, yeni yorumlar, anomaliler
						</div>
						{#if notifications.weeklyDigest.enabled}
							<div class="flex items-center gap-2 text-xs">
								<span>Her</span>
								<select
									bind:value={notifications.weeklyDigest.dayOfWeek}
									class="rounded border border-border px-2 py-1 text-xs"
								>
									{#each dayNames as d, i (i)}
										<option value={i}>{d}</option>
									{/each}
								</select>
								<span>saat</span>
								<input
									type="number"
									bind:value={notifications.weeklyDigest.sendHour}
									min="0"
									max="23"
									class="w-14 rounded border border-border px-2 py-1 text-xs"
								/>
								<span>:00 (Türkiye saati)</span>
							</div>
						{/if}
					</div>
				</label>

				<label class="flex items-start gap-3 cursor-pointer pt-3 border-t border-border">
					<input
						type="checkbox"
						bind:checked={notifications.monthlyDigest.enabled}
						class="rounded text-brand mt-1"
					/>
					<div class="flex-1">
						<div class="font-medium text-sm">Aylık Trend Raporu</div>
						<div class="text-xs text-text-3">
							Ayın 1'inde detaylı kategori bazlı performans karşılaştırması
						</div>
					</div>
				</label>
			</section>

			<!-- Anomaly alerts -->
			<section class="bg-surface-1 border border-border rounded-lg p-6 shadow-sm space-y-4">
				<header>
					<h2 class="text-base font-semibold text-text-1">Anomali Uyarıları</h2>
					<p class="text-xs text-text-3 mt-1">
						Belirgin bir değişim olduğunda anında bildirim alın.
					</p>
				</header>

				<label class="flex items-start gap-3 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={notifications.anomalyGpiDrop.enabled}
						class="rounded text-brand mt-1"
					/>
					<div class="flex-1">
						<div class="font-medium text-sm">GPI Düşüşü</div>
						<div class="text-xs text-text-3 mb-2">
							Belirli sürede GPI'niz belirli puan üzerinde düşerse uyar
						</div>
						{#if notifications.anomalyGpiDrop.enabled}
							<div class="flex items-center gap-2 text-xs">
								<input
									type="number"
									bind:value={notifications.anomalyGpiDrop.windowDays}
									min="1"
									max="30"
									class="w-14 rounded border border-border px-2 py-1 text-xs"
								/>
								<span>günde</span>
								<input
									type="number"
									bind:value={notifications.anomalyGpiDrop.pointsThreshold}
									min="1"
									max="20"
									class="w-14 rounded border border-border px-2 py-1 text-xs"
								/>
								<span>puan veya daha fazla düşüş</span>
							</div>
						{/if}
					</div>
				</label>

				<label class="flex items-start gap-3 cursor-pointer pt-3 border-t border-border">
					<input
						type="checkbox"
						bind:checked={notifications.anomalyNegSpike.enabled}
						class="rounded text-brand mt-1"
					/>
					<div class="flex-1">
						<div class="font-medium text-sm">Negatif Yorum Sıçraması</div>
						<div class="text-xs text-text-3 mb-2">
							Bir kategoride kısa sürede çok sayıda olumsuz yorum gelirse uyar
						</div>
						{#if notifications.anomalyNegSpike.enabled}
							<div class="flex items-center gap-2 text-xs">
								<input
									type="number"
									bind:value={notifications.anomalyNegSpike.windowHours}
									min="1"
									max="168"
									class="w-14 rounded border border-border px-2 py-1 text-xs"
								/>
								<span>saatte</span>
								<input
									type="number"
									bind:value={notifications.anomalyNegSpike.minCount}
									min="1"
									max="50"
									class="w-14 rounded border border-border px-2 py-1 text-xs"
								/>
								<span>veya daha fazla olumsuz yorum</span>
							</div>
						{/if}
					</div>
				</label>

				<label class="flex items-start gap-3 cursor-pointer pt-3 border-t border-border">
					<input
						type="checkbox"
						bind:checked={notifications.anomalyRpiDrop.enabled}
						class="rounded text-brand mt-1"
					/>
					<div class="flex-1">
						<div class="font-medium text-sm">RPI Düşüşü</div>
						<div class="text-xs text-text-3">
							30 gün içinde rakip ortalamasının altına düşerseniz uyar
						</div>
					</div>
				</label>
			</section>

			<!-- Save -->
			<div class="flex items-center justify-end gap-3 sticky bottom-4 bg-surface-1 border border-border rounded-lg p-3 shadow-md">
				{#if saveStatus === 'saved'}
					<span class="text-sm text-success">✓ Ayarlar kaydedildi</span>
				{/if}
				<button
					onclick={saveNotifications}
					disabled={saveStatus === 'saving'}
					class="px-5 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
				>
					{saveStatus === 'saving' ? 'Kaydediliyor…' : 'Ayarları kaydet'}
				</button>
			</div>

			<p class="text-xs text-text-3 text-center">
				Phase 1 not: kaydet butonu mock veriyle çalışır.
				<code class="font-mono">PATCH /v1/tenants/me/settings</code> endpoint'i Phase 2'de bağlanacak.
			</p>
		</Tabs.Content>
	</Tabs.Root>
</div>
