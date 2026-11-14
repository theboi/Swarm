"use client";

import dynamic from "next/dynamic";
import { Theme } from "@radix-ui/themes";
import { createHttpCoordinatorApi } from "../../coordinator/api";

const Coordinator = dynamic(() => import("../../coordinator/App").then((module) => module.App), { ssr: false, loading: () => <p role="status">Loading Swarm…</p> });
const API = createHttpCoordinatorApi();

export function SwarmApp() {
  return <Theme appearance="dark" accentColor="green" radius="large"><Coordinator api={API} /></Theme>;
}
