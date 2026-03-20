import { ConnectionStatus } from "../../types";

const palette: Record<ConnectionStatus, string> = {
  idle: "border-white/20 bg-white/10 text-white",
  scanning: "border-brand-orange/20 bg-brand-orange/20 text-white",
  connecting: "border-brand-orange/20 bg-brand-orange/20 text-white",
  connected: "border-emerald-300/30 bg-emerald-300/20 text-white",
  reconnecting: "border-brand-sage/30 bg-brand-sage/20 text-white",
  disconnected: "border-white/20 bg-white/10 text-white/80",
  error: "border-rose-300/30 bg-rose-300/20 text-white"
};

export const StatusPill = ({ status }: { status: ConnectionStatus }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] ${palette[status]}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {status}
  </span>
);
