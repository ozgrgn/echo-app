<!--
  AssistantPanel — the right-column assistant shell (ECHO_OS_PLAN.md A1 target).
  In B2 this renders a believable skeleton from mock content; A1 binds it to the
  radar federated brain (SSE stream + tools). Structure mirrors the prototype:
  scope header · thread tabs · daily brief · stream of active topics · composer.
-->
<script lang="ts">
	import { Sparkles, Ellipsis, Plus, ArrowUp, GitCompare } from '@lucide/svelte';
	import { osState } from '$lib/stores/osState.svelte';
	import { MOCK_THREADS, MOCK_BRIEF, MOCK_STREAM, type ThreadStatus } from '$lib/mock/assistant';
	import TalkwoMark from './TalkwoMark.svelte';

	// Active venue name for the scope header (from the SSR session, via the OS layout).
	let { venueName = 'Lago Hotel Sorgun' }: { venueName?: string } = $props();

	// Scope label tracks the active lens (the assistant's identity shifts per lens).
	const scopeLabel = $derived(
		osState.lens.kind === 'platform'
			? `${osState.lens.platform} uzmanı`
			: osState.lens.kind === 'department'
				? `${osState.lens.department} uzmanı`
				: osState.lens.kind === 'competitors'
					? 'Rekabet analisti'
					: 'Otel geneli'
	);

	let active = $state('t-agenda');

	const statusChip: Record<ThreadStatus, string> = {
		open: 'bg-danger-light text-danger',
		tracking: 'bg-warning-light text-warning',
		good: 'bg-success-light text-success'
	};
	const valueTone: Record<'good' | 'bad' | 'neutral', string> = {
		good: 'text-success',
		bad: 'text-danger',
		neutral: 'text-warning'
	};

	let composer = $state('');
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Scope header -->
	<header class="flex items-center gap-2.5 border-b border-border px-4 py-3">
		<TalkwoMark size={22} class="flex-none" />
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-[13px] font-bold text-text-1">
				Talkwo OS
				<span class="rounded-full bg-talkwo/10 px-2 py-0.5 text-[10px] font-bold text-talkwo">{scopeLabel}</span>
			</div>
			<div class="truncate text-[11px] text-text-3">{venueName} · tüm kaynaklar</div>
		</div>
		<button class="rounded-md p-1.5 text-text-3 hover:bg-surface-2" title="Menü">
			<Ellipsis size={16} />
		</button>
	</header>

	<!-- Thread tabs (horizontal, scrollable) -->
	<div class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface-2/40 px-3 py-2.5 [scrollbar-width:none]">
		{#each MOCK_THREADS as t (t.id)}
			<button
				onclick={() => (active = t.id)}
				class="inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition-colors
					{active === t.id
					? 'border-text-1 bg-text-1 text-white'
					: 'border-border bg-surface-1 text-text-2 hover:border-text-3 hover:text-text-1'}"
			>
				{t.label}
				{#if t.badge}
					<span class="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{t.badge}</span>
				{/if}
			</button>
		{/each}
		<button class="flex-none rounded-full p-1.5 text-text-3 hover:bg-surface-2" title="Yeni konu">
			<Plus size={15} />
		</button>
	</div>

	<!-- Daily brief -->
	<div class="m-3 mb-1 rounded-2xl border border-talkwo/20 bg-talkwo/5 p-3.5">
		<div class="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-talkwo">
			<Sparkles size={13} />{MOCK_BRIEF.title}
		</div>
		<p class="text-[12.5px] leading-relaxed text-text-1">{MOCK_BRIEF.body}</p>
	</div>

	<!-- Stream -->
	<div class="flex-1 overflow-y-auto p-3 [scrollbar-width:none]">
		<div class="mb-2 mt-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-3">
			Aktif konular · {MOCK_STREAM.length}
		</div>
		<div class="flex flex-col gap-2.5">
			{#each MOCK_STREAM as s (s.id)}
				<button class="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
					<span class="grid h-7 w-7 flex-none place-items-center rounded-lg text-[10px] font-extrabold text-white" style="background:{s.tagColor}">{s.tag}</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-1.5 text-[12.5px] font-bold text-text-1">
							{s.title}
							<span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase {statusChip[s.status]}">{s.statusLabel}</span>
						</span>
						<span class="mt-0.5 block truncate text-[11px] text-text-3">{s.sub}</span>
					</span>
					<span class="flex-none text-right">
						<span class="block text-[13px] font-extrabold {valueTone[s.valueTone]}">{s.value}</span>
						<span class="block text-[10px] text-text-3">{s.valueLabel}</span>
					</span>
				</button>
			{/each}
		</div>

		<!-- Cross-platform insight -->
		<div class="mt-3 px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-3">Çapraz-platform içgörü</div>
		<div class="mt-2 rounded-xl border border-success/30 bg-surface-1 p-3">
			<div class="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-success">
				<GitCompare size={13} />sadece genelde görünür
			</div>
			<p class="text-[12px] leading-relaxed text-text-1">
				<b>Yeme&İçme</b> TripAdvisor'da düşük (53.7) ama Google'da iyi (68). Fark akşam konaklayanlardan — asıl kaldıraç akşam menüsü.
			</p>
		</div>
	</div>

	<!-- Composer -->
	<div class="border-t border-border p-3">
		<div class="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 focus-within:bg-surface-1">
			<textarea
				bind:value={composer}
				rows="1"
				placeholder="Sor…"
				class="max-h-20 flex-1 resize-none bg-transparent text-[13px] leading-snug text-text-1 outline-none placeholder:text-text-3"
			></textarea>
			<button class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-talkwo text-white transition-opacity hover:opacity-90" title="Gönder">
				<ArrowUp size={16} />
			</button>
		</div>
		<p class="mt-1.5 px-0.5 text-[10px] text-text-3">A1'de radar beynine bağlanacak · şu an önizleme</p>
	</div>
</div>
