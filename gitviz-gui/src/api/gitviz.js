// src/api/gitviz.js
export async function fetchSnapshot(body = {}) {
  const res = await fetch('http://localhost:4000/api/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `snapshot request failed: ${res.status}`);
  }
  return res.json();
}
