<!--
  DeptHero — department-lens header band (prototype .dhero). Same skeleton as
  PlatformHero so lenses align: icon + name + scope on the left; big department
  score, target and progress on the right. Tinted with the department's accent.
-->
<script lang="ts">
	import type { DeptDetail } from '$lib/mock/departments';
	import * as icons from '@lucide/svelte';
	import { zoneClass } from '@talkwo/echo-core';

	interface Props {
		dept: DeptDetail;
	}
	let { dept }: Props = $props();

	const scoreColor = $derived(zoneClass(dept.score));

	// Resolve the lucide icon component by name (e.g. 'bed-double' → BedDouble).
	const pascal = (s: string) => s.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
	const Icon = $derived((icons as Record<string, any>)[pascal(dept.icon)] ?? icons.Building2);
</script>

<div
	class="mb-3.5 flex flex-wrap items-center gap-5 rounded-[18px] border p-5"
	style="background:{dept.color}12;border-color:{dept.color}40"
>
	<span class="grid h-[50px] w-[50px] flex-none place-items-center rounded-[13px] text-white" style="background:{dept.color}">
		<Icon size={24} strokeWidth={2} />
	</span>
	<div class="min-w-0">
		<div class="text-base font-extrabold text-text-1">{dept.label}</div>
		<div class="mt-0.5 text-xs text-text-3">{dept.subScopeCount} alt-başlıktan sorumlu · {dept.reviewCount} ilgili yorum/ay</div>
	</div>

	<div class="ml-auto flex items-end gap-3">
		<div class="flex flex-col items-end">
			<span class="text-[10.5px] font-bold uppercase tracking-wide text-text-3">Departman skoru</span>
			<span class="text-[42px] font-extrabold leading-none tracking-tight {scoreColor}">{dept.score}</span>
		</div>
		<div class="flex min-w-[84px] flex-col gap-0.5 rounded-xl border bg-surface-1 px-3 py-2.5" style="border-color:{dept.color}33">
			<span class="text-[10px] font-bold uppercase tracking-wide text-text-3">Hedef</span>
			<span class="text-[22px] font-extrabold leading-tight" style="color:{dept.color}">{dept.target}</span>
			<span class="text-[10px] text-text-3">%{dept.progressPct} ilerleme</span>
		</div>
	</div>
</div>
