<!--
  TalkwoMark — the Talkwo "T" brand mark (indigo→purple gradient), reused across
  the OS shell (rail brand, assistant header/turn avatars) so the identity is
  consistent instead of ad-hoc gradient circles.

  `flat` renders the mark in a single mid-violet (for tiny turn avatars where the
  gradient would be illegible); otherwise the full gradient.
-->
<script lang="ts">
	interface Props {
		size?: number;
		flat?: boolean;
		class?: string;
	}
	let { size = 22, flat = false, class: extra = '' }: Props = $props();

	// Unique gradient id per instance so multiple marks don't collide.
	const gid = $derived(`tw-${size}-${flat ? 'f' : 'g'}`);
</script>

<svg viewBox="0 0 72.2199 75.8007" width={size} height={(size * 75.8007) / 72.2199} class={extra} aria-label="Talkwo">
	{#if !flat}
		<defs>
			<linearGradient id={gid} x1="48.3" y1="27" x2="63.7" y2=".3" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="#4f46e5" />
				<stop offset="1" stop-color="#a855f7" />
			</linearGradient>
		</defs>
	{/if}
	<path
		d="M41.2381,18.8656v54.944c0,1.0996-.8914,1.991-1.991,1.991h-12.8835c-1.0996,0-1.991-.8914-1.991-1.991V18.866H1.991c-1.0996,0-1.991-.8914-1.991-1.991V3.991c0-1.0996.8914-1.991,1.991-1.991h22.3814c9.3146,0,16.8656,7.551,16.8656,16.8656h0Z"
		fill={flat ? '#5b4fe6' : '#4f46e5'}
	/>
	<path
		d="M69.6005,5.9817v8.9026c0,2.1871-1.7946,3.9817-3.9816,3.9817h-13.9638l-6.4353,6.4352V8.4492c0-3.5612,2.8882-6.4492,6.4491-6.4492h13.9499c2.187,0,3.9816,1.7806,3.9816,3.9817h0Z"
		fill={flat ? '#5b4fe6' : `url(#${gid})`}
	/>
</svg>
