// Login page is client-only. The auth store reads sessionStorage on
// instantiation; rendering it on the server would mismatch on hydration.
export const ssr = false;
export const prerender = false;
