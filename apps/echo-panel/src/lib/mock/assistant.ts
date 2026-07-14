/**
 * lib/mock/assistant.ts — placeholder content for the assistant panel.
 *
 * ALL of this is [MOCK→radar]: in A1 the panel binds to the radar federated brain
 * (SSE stream + tools). For now it renders a believable shell so the OS layout
 * doesn't show an empty gray box. Shapes here loosely preview the real contract
 * (threads with status, a daily brief, a stream of active topics).
 */

export type ThreadStatus = 'open' | 'tracking' | 'good';

export interface AssistantThread {
	id: string;
	label: string;
	/** owning department key (sahiplik-merkezli model) */
	ownerDept?: string;
	status: ThreadStatus;
	/** unread/attention badge */
	badge?: string;
}

// [MOCK→radar] topic threads — each issue is a thread, owned by a department.
// The goal thread reads 85 because that is the target the rest of the product solves for
// (scores/impact.ts DEFAULT_TARGET, and the /os chart's goal line). It used to say 75,
// which put a third number on a screen that already had two.
export const MOCK_THREADS: AssistantThread[] = [
	{ id: 't-agenda', label: 'Gündem', status: 'tracking' },
	{ id: 't-food', label: 'Yeme&İçme', ownerDept: 'fnb', status: 'tracking' },
	{ id: 't-volume', label: 'Hacim', status: 'open', badge: '!' },
	{ id: 't-goal85', label: 'Hedef 85', status: 'tracking' }
];

// [MOCK→radar] today's brief — radar synthesizes this from snapshots + alerts.
// Figures kept in the same neighbourhood as the real data the page shows; a brief quoting
// "GPI 70.6" beside a tile reading 81.6 is the kind of detail a viewer notices.
export const MOCK_BRIEF = {
	title: 'Bugünün özeti',
	body: 'Genel GPI 81.6 (▲0.2 bu hafta) — hedef 85’e 3.4 puan kaldı. En kritik konu: Oda kategorisi 4 aydır düşüşte (70.5), şikâyetlerin çoğu banyo temizliği. İyi tarafta HolidayCheck 86.8 ile hedefin üzerinde.'
};

// [MOCK→radar] active topics in the stream.
export interface StreamTopic {
	id: string;
	tag: string;          // short badge text
	tagColor: string;
	title: string;
	status: ThreadStatus;
	statusLabel: string;
	sub: string;
	value: string;
	valueLabel: string;
	valueTone: 'good' | 'bad' | 'neutral';
}

// The figures here are drawn from the SAME data the page renders (GPI 80.2, Google 71.2 on
// 794 reviews, Resepsiyon 75.5 falling, HolidayCheck 86.8). They used to be invented and
// contradicted the tiles beside them — "GPI 70.6" next to a card reading 81.6 tells a
// viewer the assistant is decoration. Keep these in step whenever the fixtures are refreshed.
export const MOCK_STREAM: StreamTopic[] = [
	{
		id: 's-front',
		tag: 'FO',
		tagColor: '#d64545',
		title: 'Resepsiyon düşüşte',
		status: 'open',
		statusLabel: 'kritik',
		sub: '159 mention · 4 aydır geriliyor · check-in kuyruğu',
		value: '75.5',
		valueLabel: '▼2.7',
		valueTone: 'bad'
	},
	{
		id: 's-google',
		tag: 'G',
		tagColor: '#ea4335',
		title: 'Google en zayıf kanal',
		status: 'open',
		statusLabel: 'kaldıraç',
		sub: '794 yorum · GPI 71.2 · diğer kanalların 9–15 puan altında',
		value: '71.2',
		valueLabel: 'en düşük',
		valueTone: 'bad'
	},
	{
		id: 's-goal',
		tag: '∑',
		tagColor: '#6d5efc',
		title: 'Hedef 85’e 4.8 puan',
		status: 'tracking',
		statusLabel: 'izleniyor',
		sub: 'Tüm platformlar · 80.2 → 85 · HolidayCheck (86.8) zaten üzerinde',
		value: '80.2',
		valueLabel: '/85',
		valueTone: 'neutral'
	}
];
