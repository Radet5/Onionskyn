/* where FCCore lives: the page's window, or globalThis outside a browser */
export const root = typeof window !== 'undefined' ? window : globalThis;
export const PI = Math.PI;
let _uid = 0;
export const uid = () => 'o' + Date.now().toString(36) + (_uid++).toString(36) + Math.floor(Math.random() * 46656).toString(36);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const nz = (v, d) => (v == null ? d : v);
