import type { ReactNode } from "react";

export type GsIconName = "dashboard" | "file" | "target" | "send" | "clock" | "money" | "calendar" | "chart" | "refresh" | "pipeline" | "arrow" | "eye" | "ban" | "search" | "table" | "filter" | "trash" | "edit" | "download";

const paths: Record<GsIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2"/></>,
  send: <><path d="m3 11 18-8-8 18-2-8-8-2Z"/><path d="m11 13 5-5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  money: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M17 15h.01M9 12h6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  chart: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/><path d="M2 21h20"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 6M17.9 16A7 7 0 0 1 6 18l-2-6"/></>,
  pipeline: <><path d="M4 6h10M4 12h16M4 18h7"/><circle cx="17" cy="6" r="2"/><circle cx="14" cy="18" r="2"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  ban: <><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/></>,
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4M4 20h16"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
};

export function GsIcon({ name, className = "h-5 w-5" }: { name: GsIconName; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
