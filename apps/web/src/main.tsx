import React from "react";
import ReactDOM from "react-dom/client";
import "@/shared/styles/global.css";
import { App } from "@/app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
