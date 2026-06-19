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
export const MOCK_THREADS: AssistantThread[] = [
	{ id: 't-agenda', label: 'Gündem', status: 'tracking' },
	{ id: 't-food', label: 'Yeme&İçme', ownerDept: 'fnb', status: 'tracking' },
	{ id: 't-volume', label: 'Hacim', status: 'open', badge: '!' },
	{ id: 't-goal75', label: 'Hedef 75', status: 'tracking' }
];

// [MOCK→radar] today's brief — radar synthesizes this from snapshots + alerts.
export const MOCK_BRIEF = {
	title: 'Bugünün özeti',
	body: 'Genel GPI 70.6 (▼1.2 bu hafta). 3 konu dikkat istiyor; en kritiği Booking’de yorum hacminin %32 düşmesi. İyi tarafta TripAdvisor Yeme&İçme görevin işe yarıyor.'
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

export const MOCK_STREAM: StreamTopic[] = [
	{
		id: 's-booking',
		tag: 'B',
		tagColor: '#003b95',
		title: 'Yorum hacmi düşüşü',
		status: 'open',
		statusLabel: 'kritik',
		sub: 'Booking · 71→48 (%32↓), puan 8.4→8.1',
		value: '−32%',
		valueLabel: 'hacim',
		valueTone: 'bad'
	},
	{
		id: 's-food',
		tag: 'TA',
		tagColor: '#00865a',
		title: 'Yeme&İçme toparlanıyor',
		status: 'tracking',
		statusLabel: 'izleniyor',
		sub: 'TripAdvisor · görev 3 hafta önce · 53.7→56.4',
		value: '+2.7',
		valueLabel: '3 hafta',
		valueTone: 'good'
	},
	{
		id: 's-goal',
		tag: '∑',
		tagColor: '#6d5efc',
		title: 'GPI hedefi 75',
		status: 'tracking',
		statusLabel: 'izleniyor',
		sub: 'Tüm platformlar · 70.6→75 · gidişat: risk',
		value: '70.6',
		valueLabel: '/75',
		valueTone: 'neutral'
	}
];
