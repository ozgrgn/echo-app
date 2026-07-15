<!--
  MentionList — the "En çok bahsedilen sorunlar / övülenler" list: a category pill,
  the subcategory + a sample quote, and the mention count with its share %.
  Port of the prototype's liRows() (talkwo-echo-app.html).
-->
<script lang="ts">
	interface MentionItem {
		category: string;       // display label, e.g. "Yeme&İçme"
		subcategory: string;    // display label
		excerpt: string;
		count: number;
	}

	interface Props {
		items: MentionItem[];
		/** 'issue' → red, 'praise' → green */
		tone: 'issue' | 'praise';
		/** denominator for the share % — REVIEWS or MENTIONS, per `unit` */
		total: number;
		/** What `total` counts. The department pages only track mention volume
		 *  (DepartmentScore.reviewCount IS mentionCount) — labeling that "yorum"
		 *  presented mention shares as review shares. Default stays 'yorum' for the
		 *  callers that pass a real review count (Genel). */
		unit?: 'yorum' | 'mention';
		emptyText?: string;
	}

	let { items, tone, total, unit = 'yorum', emptyText = 'Bu dönemde belirgin bir kayıt yok.' }: Props = $props();

	const pillClass = $derived(tone === 'issue' ? 'bg-danger-light text-danger' : 'bg-success-light text-success');
	const countClass = $derived(tone === 'issue' ? 'text-danger' : 'text-success');
	const pct = (n: number) => Math.round((n / total) * 100);
	const shareTitle = $derived((n: number) =>
		unit === 'mention'
			? `${total} mention içinde %${pct(n)} pay`
			: `${total} yorumun %${pct(n)}'inde geçti`
	);
</script>

{#if items.length === 0}
	<p class="px-1 py-2 text-sm text-text-3">{emptyText}</p>
{:else}
	<ul>
		{#each items as item (item.category + item.subcategory)}
			<li class="grid grid-cols-[92px_1fr_auto] items-start gap-3 border-t border-surface-2 py-2.5 first:border-t-0">
				<span class="w-full truncate rounded-lg px-2 py-1 text-center text-[10.5px] font-bold {pillClass}">
					{item.category}
				</span>
				<div class="min-w-0">
					<div class="text-[13px] font-semibold capitalize text-text-1">{item.subcategory}</div>
					<div class="truncate text-[11.5px] italic text-text-3">"{item.excerpt}"</div>
				</div>
				<span class="whitespace-nowrap text-right text-[13.5px] font-extrabold {countClass}" title={shareTitle(item.count)}>
					×{item.count}
					<small class="block text-[10px] font-semibold text-text-3">%{pct(item.count)}</small>
				</span>
			</li>
		{/each}
	</ul>
{/if}
