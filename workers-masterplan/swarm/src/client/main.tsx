import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { createHttpCoordinatorApi } from "./api.js";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

createRoot(root).render(<StrictMode><App api={createHttpCoordinatorApi()} /></StrictMode>);
