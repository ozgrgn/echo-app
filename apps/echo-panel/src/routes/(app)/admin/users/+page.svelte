<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { EchoUserRecord, OpsVenueOption } from '@talkwo/echo-ui';

	let { data } = $props();

	let phoneQuery = $state(data.phone ?? '');
	let saving = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	function flash(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2500);
	}

	// Same-origin write proxy (HttpOnly cookie carries the JWT server-side).
	async function postAdmin(body: Record<string, unknown>): Promise<void> {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? 'İşlem başarısız');
		}
	}

	function search() {
		const p = phoneQuery.trim();
		goto(p ? `/admin/users?phone=${encodeURIComponent(p)}` : '/admin/users', {
			keepFocus: true
		});
	}

	async function toggleAccess(u: EchoUserRecord) {
		saving = true;
		try {
			await postAdmin({
				action: 'setEchoUserAccess',
				staffId: u.staffId,
				access: { enabled: !u.echo_access.enabled, scope: u.echo_access.scope }
			});
			flash(u.echo_access.enabled ? 'ECHO erişimi kapatıldı' : 'ECHO erişimi açıldı');
			await invalidateAll();
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	async function setScope(u: EchoUserRecord, scope: 'venue' | 'department') {
		if (scope === u.echo_access.scope) return;
		saving = true;
		try {
			await postAdmin({
				action: 'setEchoUserAccess',
				staffId: u.staffId,
				access: { enabled: u.echo_access.enabled, scope }
			});
			flash(scope === 'venue' ? 'Kapsam: otel geneli' : 'Kapsam: kendi departmanı');
			await invalidateAll();
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	// ── create form (standalone tenants: person has no Hoops staff row) ──────
	let showCreate = $state(false);
	let cVenue = $state(''); // `${tenantKey}::${venueId}`
	let cName = $state('');
	let cRole = $state('genel_mudur');
	let cDepartment = $state('management');
	let cPhone = $state('');
	let cScope = $state<'venue' | 'department'>('venue');

	async function createUser() {
		const [tenantKey, venueId] = cVenue.split('::');
		if (!tenantKey || !venueId || !cName.trim() || !cRole.trim() || !cDepartment.trim()) {
			flash('Otel, isim, rol ve departman zorunlu');
			return;
		}
		saving = true;
		try {
			await postAdmin({
				action: 'createEchoUser',
				payload: {
					tenantKey,
					venueId,
					name: cName.trim(),
					role: cRole.trim(),
					department: cDepartment.trim(),
					...(cPhone.trim() ? { phone: cPhone.trim() } : {}),
					scope: cScope
				}
			});
			flash('Kullanıcı oluşturuldu ve ECHO erişimi açıldı');
			showCreate = false;
			cName = '';
			cPhone = '';
			if (cPhone.trim()) {
				phoneQuery = cPhone.trim();
				search();
			} else {
				await invalidateAll();
			}
		} catch (e) {
			flash('Hata: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	const venueLabel = (v: OpsVenueOption) => `${v.name} (${v.tenantKey})`;
</script>

<div class="max-w-3xl">
	<header class="mb-6">
		<h1 class="text-xl font-bold text-text-1">Yönetim — Kullanıcılar</h1>
		<p class="text-sm text-text-3 mt-1">
			ECHO'ya kim girebilir? Kimlik ops-engine'de yaşar; burada yalnızca kişi bazlı ECHO
			erişimi (ve kapsamı) yönetilir — Hoops rolüne/departmanına dokunulmaz.
		</p>
	</header>

	<!-- Phone lookup -->
	<section class="bg-surface-1 border border-border rounded-lg p-5 mb-6">
		<header class="flex items-center justify-between mb-3">
			<h2 class="font-semibold text-text-1">Telefonla ara</h2>
			<button
				class="text-xs text-brand hover:underline"
				onclick={() => (showCreate = !showCreate)}
			>
				{showCreate ? 'Aramaya dön' : '+ Yeni kullanıcı (Hoops kaydı olmayan otel)'}
			</button>
		</header>

		{#if !showCreate}
			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					search();
				}}
			>
				<input
					type="tel"
					bind:value={phoneQuery}
					placeholder="05XX XXX XX XX"
					class="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-surface-2"
				/>
				<button
					type="submit"
					class="text-sm bg-brand text-white px-3 py-1.5 rounded-md disabled:opacity-50"
					disabled={saving}
				>
					Ara
				</button>
			</form>

			{#if data.phone}
				<ul class="divide-y divide-border mt-4">
					{#each data.users as u (u.staffId)}
						<li class="py-3 flex items-center gap-3">
							<div class="flex-1 min-w-0">
								<div class="font-medium text-text-1 truncate">{u.name}</div>
								<div class="text-xs text-text-3 truncate">
									{u.venueName ?? u.slug ?? '—'} · {u.role}{u.department ? ` · ${u.department}` : ''}
									{#if !u.slug}
										<span class="text-warning"> · slug yok — ECHO bu oteli sunamaz</span>
									{/if}
								</div>
							</div>
							{#if u.echo_access.enabled}
								<select
									class="text-xs border border-border rounded px-1.5 py-1 bg-surface-2"
									value={u.echo_access.scope}
									disabled={saving}
									onchange={(e) => setScope(u, e.currentTarget.value as 'venue' | 'department')}
								>
									<option value="venue">Otel geneli</option>
									<option value="department">Kendi departmanı</option>
								</select>
								<span class="text-xs px-2 py-0.5 rounded bg-success-light border border-success text-text-1">
									ECHO açık
								</span>
								<button
									class="text-xs text-danger hover:underline"
									disabled={saving}
									onclick={() => toggleAccess(u)}
								>
									kapat
								</button>
							{:else}
								<button
									class="text-sm bg-brand text-white px-3 py-1.5 rounded-md disabled:opacity-50"
									disabled={saving}
									onclick={() => toggleAccess(u)}
								>
									ECHO erişimi ver
								</button>
							{/if}
						</li>
					{:else}
						<li class="py-6 text-center text-sm text-text-3">
							Bu telefona kayıtlı aktif personel yok. Hoops kaydı olmayan bir otel içinse
							"+ Yeni kullanıcı" ile satır açın.
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<!-- Create echo-only staff row -->
			<div class="space-y-3">
				<label class="block">
					<span class="text-xs text-text-2">Otel</span>
					<select
						bind:value={cVenue}
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
					>
						<option value="" disabled>Otel seçin…</option>
						{#each data.venues as v (`${v.tenantKey}::${v.venueId}`)}
							<option value={`${v.tenantKey}::${v.venueId}`}>{venueLabel(v)}</option>
						{/each}
					</select>
				</label>
				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-xs text-text-2">İsim</span>
						<input
							bind:value={cName}
							class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
							placeholder="Ad Soyad"
						/>
					</label>
					<label class="block">
						<span class="text-xs text-text-2">Telefon (opsiyonel — OTP buraya gider)</span>
						<input
							bind:value={cPhone}
							type="tel"
							class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
							placeholder="05XX XXX XX XX"
						/>
					</label>
					<label class="block">
						<span class="text-xs text-text-2">Rol (ops-engine rol anahtarı)</span>
						<input
							bind:value={cRole}
							class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
							placeholder="genel_mudur"
						/>
					</label>
					<label class="block">
						<span class="text-xs text-text-2">Departman</span>
						<input
							bind:value={cDepartment}
							class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
							placeholder="management"
						/>
					</label>
				</div>
				<label class="block">
					<span class="text-xs text-text-2">Kapsam</span>
					<select
						bind:value={cScope}
						class="w-full border border-border rounded px-2 py-1.5 bg-surface-2 text-sm"
					>
						<option value="venue">Otel geneli</option>
						<option value="department">Kendi departmanı</option>
					</select>
				</label>
				<button
					class="text-sm bg-brand text-white px-3 py-1.5 rounded-md disabled:opacity-50"
					disabled={saving}
					onclick={createUser}
				>
					Oluştur ve ECHO erişimi ver
				</button>
			</div>
		{/if}
	</section>

	<p class="text-xs text-text-3">
		Not: Telefonsuz oluşturulan kullanıcı OTP alamaz — kayıt hazır bekler, telefon eklenince
		giriş açılır. Superadmin'ler bu listeden bağımsızdır (sabit OTP ile girer, ECHO erişimi
		açık tüm otelleri görür).
	</p>
</div>

{#if toast}
	<div class="fixed bottom-4 right-4 bg-surface-1 border border-border rounded-md px-4 py-2 text-sm text-text-1 shadow-lg">
		{toast}
	</div>
{/if}
