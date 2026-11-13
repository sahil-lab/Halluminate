import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/space-grotesk";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("The application root element is missing.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
