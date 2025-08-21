import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000/api";

function getStoredRepo() {
  return localStorage.getItem("repoUrl") || "";
}

export default function Contributors() {
  const [repoUrl] = useState(getStoredRepo());
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!repoUrl) {
      setError("No repo URL found. Please enter a repo URL in Dashboard first.");
      setLoading(false);
      return;
    }

    async function fetchContributors() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/contributors?repoUrl=${encodeURIComponent(repoUrl)}`);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server error: ${text}`);
        }

        const data = await res.json();

        if (!Array.isArray(data)) throw new Error("Invalid response format from server");

        setContributors(data);
      } catch (err) {
        console.error("Fetch contributors error:", err);
        setError(err.message || "Failed to fetch contributors");
      } finally {
        setLoading(false);
      }
    }

    fetchContributors();
  }, [repoUrl]);

  if (loading) return <div>Loading contributors…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!contributors.length) return <div>No contributors found</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Contributors</h2>
      <table className="w-full text-sm border">
        <thead>
          <tr className="border-b">
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th className="text-right">Commits</th>
          </tr>
        </thead>
        <tbody>
          {contributors.map((c, i) => (
            <tr key={i} className="border-b">
              <td>{i + 1}</td>
              <td>{c.name}</td>
              <td>{c.email}</td>
              <td className="text-right">{c.commits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
