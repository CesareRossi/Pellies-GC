import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// StrictMode intentionally omitted: it double-invokes effects in dev,
// which triggers a supabase-js body-stream race during auth initialization.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
