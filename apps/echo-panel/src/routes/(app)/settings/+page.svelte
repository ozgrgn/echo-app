<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { PLATFORM_REGISTRY, type HoopsNotifSettings } from '@talkwo/echo-core';

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
		{ value: 'notifications', label: 'ECHO Bildirimleri', icon: '🔔' },
		{ value: 'hoops', label: 'Hoops Bildirimleri', icon: '📡' }
	];

	// ── Hoops Notification Settings ──────────────────────────────────────

	const DEPT_OPTIONS = [
		{ key: 'hk',  label: 'HK',  fullLabel: 'Kat Hizmetleri',   colorClass: 'bg-info-light    text-info    border-info/40'    },
		{ key: 'fnb', label: 'FnB', fullLabel: 'Yiyecek & İçecek', colorClass: 'bg-warning-light text-warning border-warning/40' },
		{ key: 'mnt', label: 'MNT', fullLabel: 'Teknik Bakım',     colorClass: 'bg-danger-light  text-danger  border-danger/40'  },
		{ key: 'spa', label: 'SPA', fullLabel: 'SPA',              colorClass: 'bg-surface-2     text-text-1  border-border'      },
	] as const;

	const ASPECT_ROUTING_MAP = [
		{ label: 'Oda & Temizlik',    dept: 'HK',  deptClass: 'bg-info-light    text-info    border-info/30'    },
		{ label: 'Yiyecek & İçecek',  dept: 'FnB', deptClass: 'bg-warning-light text-warning border-warning/30' },
		{ label: 'Teknik & Altyapı',  dept: 'MNT', deptClass: 'bg-danger-light  text-danger  border-danger/30'  },
		{ label: 'SPA & Wellness',    dept: 'SPA', deptClass: 'bg-surface-2     text-text-1  border-border'      },
		{ label: 'Servis & Genel',    dept: 'GR',  deptClass: 'bg-success-light text-success border-success/30' },
	];

	// HoopsNotifSettings is imported from @talkwo/echo-core.
	// Initialise from server-loaded settings; fall back to safe defaults if
	// the venue has never saved Hoops config (first-time setup).
	const DEFAULT_HOOPS: HoopsNotifSettings = {
		triggers: {
			critical:      { enabled: true,  ratingThreshold: 2,  departments: [],         slaMinutes: 30  },
			negative:      { enabled: true,  ratingThreshold: 3,  departments: [],         slaMinutes: 120 },
			unanswered:    { enabled: true,  hoursThreshold: 24,  escalation: 'normal_to_urgent'           },
			aspectRouting: { enabled: true  },
			dailyDigest:   { enabled: false, sendHour: 8,         departments: ['hk', 'fnb']               },
		},
	};

	let hoopsNotifs = $state<HoopsNotifSettings>(
		data.venueSettings?.hoopsNotifications ?? DEFAULT_HOOPS
	);

	function toggleDeptInList(list: string[], dept: string): string[] {
		return list.includes(dept) ? list.filter((d) => d !== dept) : [...list, dept];
	}

	let hoopsSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let hoopsSaveError = $state('');
	async function saveHoopsNotifs() {
		const venueSlug = data.ownVenue?.slug;
		if (!venueSlug) return;
		hoopsSaveStatus = 'saving';
		hoopsSaveError = '';
		try {
			const res = await fetch('/api/venue-settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ venueSlug, patch: { hoopsNotifications: hoopsNotifs } })
			});
			if (!res.ok) throw new Error('Ayarlar kaydedilemedi');
			hoopsSaveStatus = 'saved';
			setTimeout(() => (hoopsSaveStatus = 'idle'), 2000);
		} catch (err) {
			hoopsSaveStatus = 'error';
			hoopsSaveError = err instanceof Error ? err.message : 'Kayıt başarısız';
		}
	}

	// Toggle helper component (inline since one component file isn't worth it)
	function toggleClass(on: boolean): string {
		return [
			'mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative border-2 border-transparent',
			on ? 'bg-brand' : 'bg-border'
		].join(' ');
	}
	function toggleKnobClass(on: boolean): string {
		return [
			'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
			on ? 'left-4' : 'left-0'
		].join(' ');
	}
</script>

<div class="space-y-6">
	<header>
		<p class="text-sm text-text-2">
			Tenant: <code class="font-mono text-text-1">{data.tenantKey}</code>
			{#if sub}
				<span class="ml-2 px-2 py-0.5 rounded bg-brand-light text-brand text-xs font-medium uppercase">
					ECHO {sub.tier}
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
							<a href="mailto:hello@talkwo.com" class="text-brand hover:underline">
								hello@talkwo.com
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
						<a href="mailto:hello@talkwo.com" class="inline-block text-sm text-brand hover:underline">
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
										{c.region?.area ?? '—'}
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
		<!-- ── Hoops Notifications tab ───────────────────────────────────── -->
		<Tabs.Content value="hoops" class="space-y-4">

			<!-- Connection status -->
			<div class="flex items-center gap-2 px-4 py-3 rounded-lg border bg-warning-light/40 border-warning/30 text-sm">
				<span>⚠️</span>
				<span class="font-medium text-warning-dark">ops-engine bağlantısı yapılandırılmamış</span>
				<span class="text-text-3 text-xs ml-2">— Phase 2'de otomatik aktif olacak</span>
			</div>

			<p class="text-sm text-text-2 leading-relaxed">
				Aşağıdaki koşullar gerçekleştiğinde <strong class="text-text-1">Hoops</strong>'ta
				görev oluşturulur. İlgili departman çalışanlarına push / Telegram bildirimi gider.
				<strong class="text-text-1">GR</strong> her tetikleyicide varsayılan alıcıdır, kaldırılamaz.
			</p>

			<!-- ─ Trigger 1: Kritik Yorum ─ -->
			<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
				<div class="flex items-start gap-4">
					<button
						role="switch"
						aria-checked={hoopsNotifs.triggers.critical.enabled}
						onclick={() => (hoopsNotifs.triggers.critical.enabled = !hoopsNotifs.triggers.critical.enabled)}
						class={toggleClass(hoopsNotifs.triggers.critical.enabled)}
					>
						<span class={toggleKnobClass(hoopsNotifs.triggers.critical.enabled)}></span>
					</button>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-base">🔴</span>
							<h3 class="text-sm font-semibold text-text-1">Kritik yorum</h3>
							<span class="text-[10px] px-2 py-0.5 rounded bg-danger-light text-danger font-medium uppercase tracking-wider">acil</span>
						</div>
						<p class="text-xs text-text-2 mb-3">Düşük puanlı yorum geldiğinde anında görev açılır, escalation zinciri tetiklenir.</p>
						{#if hoopsNotifs.triggers.critical.enabled}
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-text-3">Puan ≤</span>
									<input
										type="number" min="1" max="3"
										bind:value={hoopsNotifs.triggers.critical.ratingThreshold}
										class="w-12 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">yıldız</span>
								</div>
								<span class="text-text-3 text-xs">→</span>
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-xs text-text-3">Ek departman:</span>
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-light text-success border border-success/30 opacity-70 cursor-not-allowed"
										title="GR her zaman alıcıdır">🔒 GR</span>
									{#each DEPT_OPTIONS as d (d.key)}
										{@const active = hoopsNotifs.triggers.critical.departments.includes(d.key)}
										<button
											onclick={() => (hoopsNotifs.triggers.critical.departments = toggleDeptInList(hoopsNotifs.triggers.critical.departments, d.key))}
											class={['px-2 py-1 rounded-full text-xs font-medium border transition-colors',
												active ? d.colorClass : 'bg-surface-1 text-text-3 border-border hover:bg-surface-2']}
											title={d.fullLabel}
										>{active ? '' : '+ '}{d.label}</button>
									{/each}
								</div>
								<div class="flex items-center gap-1.5 ml-auto">
									<span class="text-xs text-text-3">SLA yanıt:</span>
									<input
										type="number" min="15" max="240"
										bind:value={hoopsNotifs.triggers.critical.slaMinutes}
										class="w-14 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">dk</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- ─ Trigger 2: Olumsuz Yorum ─ -->
			<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
				<div class="flex items-start gap-4">
					<button
						role="switch"
						aria-checked={hoopsNotifs.triggers.negative.enabled}
						onclick={() => (hoopsNotifs.triggers.negative.enabled = !hoopsNotifs.triggers.negative.enabled)}
						class={toggleClass(hoopsNotifs.triggers.negative.enabled)}
					>
						<span class={toggleKnobClass(hoopsNotifs.triggers.negative.enabled)}></span>
					</button>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-base">🟡</span>
							<h3 class="text-sm font-semibold text-text-1">Olumsuz yorum</h3>
							<span class="text-[10px] px-2 py-0.5 rounded bg-warning-light text-warning font-medium uppercase tracking-wider">yüksek</span>
						</div>
						<p class="text-xs text-text-2 mb-3">3 yıldız ve altı ya da çoğunlukla negatif aspect içeren yorum.</p>
						{#if hoopsNotifs.triggers.negative.enabled}
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-text-3">Puan ≤</span>
									<input
										type="number" min="1" max="4"
										bind:value={hoopsNotifs.triggers.negative.ratingThreshold}
										class="w-12 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">yıldız</span>
								</div>
								<span class="text-text-3 text-xs">→</span>
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-xs text-text-3">Ek departman:</span>
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-light text-success border border-success/30 opacity-70 cursor-not-allowed"
										title="GR her zaman alıcıdır">🔒 GR</span>
									{#each DEPT_OPTIONS as d (d.key)}
										{@const active = hoopsNotifs.triggers.negative.departments.includes(d.key)}
										<button
											onclick={() => (hoopsNotifs.triggers.negative.departments = toggleDeptInList(hoopsNotifs.triggers.negative.departments, d.key))}
											class={['px-2 py-1 rounded-full text-xs font-medium border transition-colors',
												active ? d.colorClass : 'bg-surface-1 text-text-3 border-border hover:bg-surface-2']}
											title={d.fullLabel}
										>{active ? '' : '+ '}{d.label}</button>
									{/each}
								</div>
								<div class="flex items-center gap-1.5 ml-auto">
									<span class="text-xs text-text-3">SLA yanıt:</span>
									<input
										type="number" min="30" max="480"
										bind:value={hoopsNotifs.triggers.negative.slaMinutes}
										class="w-14 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">dk</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- ─ Trigger 3: Yanıtsız ─ -->
			<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
				<div class="flex items-start gap-4">
					<button
						role="switch"
						aria-checked={hoopsNotifs.triggers.unanswered.enabled}
						onclick={() => (hoopsNotifs.triggers.unanswered.enabled = !hoopsNotifs.triggers.unanswered.enabled)}
						class={toggleClass(hoopsNotifs.triggers.unanswered.enabled)}
					>
						<span class={toggleKnobClass(hoopsNotifs.triggers.unanswered.enabled)}></span>
					</button>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-base">⏳</span>
							<h3 class="text-sm font-semibold text-text-1">Yanıtsız kritik yorum</h3>
							<span class="text-[10px] px-2 py-0.5 rounded bg-danger-light text-danger font-medium uppercase tracking-wider">acil</span>
						</div>
						<p class="text-xs text-text-2 mb-3">Belirli süre yanıt verilmemiş olumsuz yorumlar için yönetici hatırlatması.</p>
						{#if hoopsNotifs.triggers.unanswered.enabled}
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-text-3">Yanıt yok &gt;</span>
									<input
										type="number" min="1" max="168"
										bind:value={hoopsNotifs.triggers.unanswered.hoursThreshold}
										class="w-14 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">saat</span>
								</div>
								<span class="text-text-3 text-xs">→</span>
								<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-light text-success border border-success/30 opacity-70 cursor-not-allowed"
									title="GR her zaman alıcıdır">🔒 GR</span>
								<div class="flex items-center gap-1.5 ml-auto">
									<span class="text-xs text-text-3">Öncelik yükseltme:</span>
									<select
										bind:value={hoopsNotifs.triggers.unanswered.escalation}
										class="rounded border border-border bg-surface-1 px-2 py-1 text-xs"
									>
										<option value="normal_to_urgent">normal → acil</option>
										<option value="normal_to_high">normal → yüksek</option>
										<option value="fixed_normal">normal (sabit)</option>
									</select>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- ─ Trigger 4: Aspect Yönlendirme ─ -->
			<section class="bg-surface-1 border border-border rounded-lg p-5 shadow-sm">
				<div class="flex items-start gap-4">
					<button
						role="switch"
						aria-checked={hoopsNotifs.triggers.aspectRouting.enabled}
						onclick={() => (hoopsNotifs.triggers.aspectRouting.enabled = !hoopsNotifs.triggers.aspectRouting.enabled)}
						class={toggleClass(hoopsNotifs.triggers.aspectRouting.enabled)}
					>
						<span class={toggleKnobClass(hoopsNotifs.triggers.aspectRouting.enabled)}></span>
					</button>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-base">↔️</span>
							<h3 class="text-sm font-semibold text-text-1">Aspect bazlı yönlendirme</h3>
						</div>
						<p class="text-xs text-text-2 mb-3">
							Yorumdaki olumsuz kategoriye göre ilgili departmana ek görev açılır.
							GR ile birlikte çalışır.
						</p>
						{#if hoopsNotifs.triggers.aspectRouting.enabled}
							<div class="border border-border rounded-md overflow-hidden text-xs mb-2">
								<div class="grid grid-cols-2 px-3 py-2 bg-surface-2 font-medium text-text-2 border-b border-border">
									<span>Yorum kategorisi</span>
									<span>Hedef departman</span>
								</div>
								{#each ASPECT_ROUTING_MAP as row, i (row.label)}
									<div class={['grid grid-cols-2 px-3 py-2 items-center', i < ASPECT_ROUTING_MAP.length - 1 ? 'border-b border-border' : '']}>
										<span class="text-text-1">{row.label}</span>
										<span class={['inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium border', row.deptClass]}>{row.dept}</span>
									</div>
								{/each}
							</div>
							<p class="text-[11px] text-text-3">
								Eşleşme yoksa yalnızca GR alır. Aynı yorumda birden fazla aspect varsa birden fazla departmana görev gider — hepsi aynı
								<code class="font-mono bg-surface-2 px-1 rounded">group_id</code>'yi paylaşır.
							</p>
						{/if}
					</div>
				</div>
			</section>

			<!-- ─ Trigger 5: Günlük Özet ─ -->
			<section class={['bg-surface-1 border border-border rounded-lg p-5 shadow-sm transition-opacity',
				!hoopsNotifs.triggers.dailyDigest.enabled ? 'opacity-70' : '']}>
				<div class="flex items-start gap-4">
					<button
						role="switch"
						aria-checked={hoopsNotifs.triggers.dailyDigest.enabled}
						onclick={() => (hoopsNotifs.triggers.dailyDigest.enabled = !hoopsNotifs.triggers.dailyDigest.enabled)}
						class={toggleClass(hoopsNotifs.triggers.dailyDigest.enabled)}
					>
						<span class={toggleKnobClass(hoopsNotifs.triggers.dailyDigest.enabled)}></span>
					</button>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-base">📅</span>
							<h3 class="text-sm font-semibold text-text-1">Günlük özet görevi</h3>
							{#if !hoopsNotifs.triggers.dailyDigest.enabled}
								<span class="text-[10px] px-2 py-0.5 rounded bg-surface-2 text-text-3 font-medium">kapalı</span>
							{/if}
						</div>
						<p class="text-xs text-text-2 mb-3">Her sabah departman bazlı yorum özeti görevi oluştur.</p>
						{#if hoopsNotifs.triggers.dailyDigest.enabled}
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-text-3">Saat:</span>
									<input
										type="number" min="0" max="23"
										bind:value={hoopsNotifs.triggers.dailyDigest.sendHour}
										class="w-12 rounded border border-border bg-surface-1 px-2 py-1 text-xs text-center"
									/>
									<span class="text-xs text-text-3">:00 (Türkiye saati)</span>
								</div>
								<span class="text-text-3 text-xs">→</span>
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-xs text-text-3">Departmanlar:</span>
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-light text-success border border-success/30 opacity-70 cursor-not-allowed"
										title="GR her zaman alıcıdır">🔒 GR</span>
									{#each DEPT_OPTIONS as d (d.key)}
										{@const active = hoopsNotifs.triggers.dailyDigest.departments.includes(d.key)}
										<button
											onclick={() => (hoopsNotifs.triggers.dailyDigest.departments = toggleDeptInList(hoopsNotifs.triggers.dailyDigest.departments, d.key))}
											class={['px-2 py-1 rounded-full text-xs font-medium border transition-colors',
												active ? d.colorClass : 'bg-surface-1 text-text-3 border-border hover:bg-surface-2']}
											title={d.fullLabel}
										>{active ? '' : '+ '}{d.label}</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- Save bar -->
			<div class="flex items-center justify-between gap-3 sticky bottom-4 bg-surface-1 border border-border rounded-lg p-3 shadow-md">
				<span class="text-xs text-text-3">
					Kaydedilince <code class="font-mono bg-surface-2 px-1 rounded text-xs">PATCH /v1/venues/me/settings</code>'e yazılır
				</span>
				<div class="flex items-center gap-3">
					{#if hoopsSaveStatus === 'saved'}
						<span class="text-sm text-success">✓ Ayarlar kaydedildi</span>
					{:else if hoopsSaveStatus === 'error'}
						<span class="text-sm text-danger">✗ {hoopsSaveError}</span>
					{/if}
					<button
						onclick={saveHoopsNotifs}
						disabled={hoopsSaveStatus === 'saving'}
						class="px-5 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
					>
						{hoopsSaveStatus === 'saving' ? 'Kaydediliyor…' : 'Ayarları kaydet'}
					</button>
				</div>
			</div>

			<p class="text-xs text-text-3 text-center">
				Phase 1: ayarlar local state'te tutulmaktadır. ops-engine bağlantısı Phase 2'de aktif olacak.
			</p>
		</Tabs.Content>
	</Tabs.Root>
</div>
