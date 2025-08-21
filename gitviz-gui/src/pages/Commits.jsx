import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000/api";

export default function Commits() {
  const [commits, setCommits] = useState([]);
  const [repoUrl] = useState(localStorage.getItem("repoUrl") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCommits() {
      if (!repoUrl) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/commits?repoUrl=${encodeURIComponent(repoUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch commits");
        setCommits(data);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchCommits();
  }, [repoUrl]);

  if (!repoUrl) return <div className="text-red-600">Please enter repo URL in Dashboard first</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Commits</h2>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {commits.length > 0 && (
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b">
              <th>#</th>
              <th>Hash</th>
              <th>Author</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {commits.map((c, i) => (
              <tr key={i} className="border-b">
                <td>{i + 1}</td>
                <td>{c.hash}</td>
                <td>{c.author}</td>
                <td>{c.message}</td>
                <td>{c.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
