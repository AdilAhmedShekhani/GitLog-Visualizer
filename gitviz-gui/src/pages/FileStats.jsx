import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000/api";

export default function FileStats() {
  const [files, setFiles] = useState([]);
  const [repoUrl] = useState(localStorage.getItem("repoUrl") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchFiles() {
      if (!repoUrl) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/file-stats?repoUrl=${encodeURIComponent(repoUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch files");
        setFiles(data);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, [repoUrl]);

  if (!repoUrl) return <div className="text-red-600">Please enter repo URL in Dashboard first</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">File Stats</h2>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {files.length > 0 && (
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b">
              <th>Path</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => (
              <tr key={i} className="border-b">
                <td>{f.path}</td>
                <td>{f.changes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
