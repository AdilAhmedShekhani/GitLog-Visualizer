import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/contributors", label: "Contributors" },
    { to: "/file-stats", label: "File Stats" },
    { to: "/commits", label: "Commits" },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col gap-4">
      <h2 className="text-xl font-bold mb-6">GitViz</h2>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `px-3 py-2 rounded hover:bg-gray-700 ${isActive ? "bg-gray-700" : ""}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </aside>
  );
}
