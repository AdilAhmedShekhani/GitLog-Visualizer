import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./layouts/Layout";
import Dashboard from "./pages/Dashboard";
import Contributors from "./pages/Contributors";
import FileStats from "./pages/FileStats";
import Commits from "./pages/Commits";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contributors" element={<Contributors />} />
          <Route path="/file-stats" element={<FileStats />} />
          <Route path="/commits" element={<Commits />} />
        </Routes>
      </Layout>
    </Router>
  );
}
