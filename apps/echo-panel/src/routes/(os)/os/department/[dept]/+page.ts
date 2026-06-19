import type { PageLoad } from './$types';
import { DEPARTMENTS, DEPARTMENT_KEYS } from '$lib/mock/departments';
import { error } from '@sveltejs/kit';

// Department lens. v1 is mock-only (department→subcategory ownership + goal
// intelligence are future backend/radar work — see ECHO_OS_PLAN.md). The full
// breakdown (subcategories, complaints, goals, leverage) comes from the rich mock.
export const ssr = false;

export const load: PageLoad = async ({ params }) => {
	const dept = DEPARTMENTS[params.dept];
	if (!dept) throw error(404, `Unknown department: ${params.dept}`);

	// Sibling departments for the in-lens switcher.
	const siblings = DEPARTMENT_KEYS.map((k) => ({
		key: k,
		label: DEPARTMENTS[k].label,
		color: DEPARTMENTS[k].color,
	}));

	return { dept, siblings };
};
