import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SnapshotProvider } from "./context/SnapshotContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SnapshotProvider>
      <App />
    </SnapshotProvider>
  </React.StrictMode>
);
