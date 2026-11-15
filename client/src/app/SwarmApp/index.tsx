"use client";

import dynamic from "next/dynamic";
import { createHttpCoordinatorApi } from "../../coordinator/api";

const Coordinator = dynamic(() => import("../../coordinator/App").then((module) => module.App), { ssr: false, loading: () => <p role="status">Loading Swarm…</p> });
const API = createHttpCoordinatorApi();

export function SwarmApp() {
  return <Coordinator api={API} />;
}
