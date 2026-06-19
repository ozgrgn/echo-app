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
		/** total reviews, to compute the share % */
		total: number;
		emptyText?: string;
	}

	let { items, tone, total, emptyText = 'Bu dönemde belirgin bir kayıt yok.' }: Props = $props();

	const pillClass = $derived(tone === 'issue' ? 'bg-danger-light text-danger' : 'bg-success-light text-success');
	const countClass = $derived(tone === 'issue' ? 'text-danger' : 'text-success');
	const pct = (n: number) => Math.round((n / total) * 100);
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
				<span class="whitespace-nowrap text-right text-[13.5px] font-extrabold {countClass}" title="{total} yorumun %{pct(item.count)}'inde geçti">
					×{item.count}
					<small class="block text-[10px] font-semibold text-text-3">%{pct(item.count)}</small>
				</span>
			</li>
		{/each}
	</ul>
{/if}
