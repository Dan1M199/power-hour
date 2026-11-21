// This device's memory. Storage can be off (private windows, full disks), so every read and write is wrapped and a
// failure reads as nothing stored.
export const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
export const getJson = (k, d = null) => { try { return JSON.parse(get(k)) ?? d; } catch { return d; } };
export const putJson = (k, v) => put(k, JSON.stringify(v));
