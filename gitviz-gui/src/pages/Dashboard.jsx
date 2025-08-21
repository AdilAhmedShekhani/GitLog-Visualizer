import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const API_BASE = "http://localhost:5000/api";

function getStoredRepo() {
  return localStorage.getItem("repoUrl") || "";
}

export default function Dashboard() {
  const [repoUrl, setRepoUrl] = useState(getStoredRepo());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [commits, setCommits] = useState([]);

  async function analyze() {
    if (!repoUrl) {
      setError("Enter GitHub repo URL (https://github.com/user/repo)");
      return;
    }
    setError("");
    setLoading(true);
    setCommits([]);
    localStorage.setItem("repoUrl", repoUrl);

    try {
      const res = await fetch(`${API_BASE}/commits?repoUrl=${encodeURIComponent(repoUrl)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch commits");
      setCommits(Array.isArray(json) ? json : []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const monthly = useMemo(() => {
    const map = {};
    for (const c of commits) {
      const key = (c.date || "").slice(0, 7);
      if (!key) continue;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));
  }, [commits]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="flex gap-2 mb-4">
        <input
          className="border px-3 py-2 rounded w-full md:w-2/3"
          placeholder="GitHub repo URL"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
        />
        <button onClick={analyze} disabled={loading} className="bg-black text-white px-4 py-2 rounded">
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}

      {!!monthly.length && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-3">Commit Frequency (Monthly)</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#111827" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
