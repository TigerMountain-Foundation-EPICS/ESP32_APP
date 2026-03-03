import { ConnectionStatus } from "../../types";

const palette: Record<ConnectionStatus, string> = {
  idle: "bg-slate-200 text-slate-700",
  scanning: "bg-amber-100 text-amber-800",
  connecting: "bg-amber-100 text-amber-800",
  connected: "bg-emerald-100 text-emerald-800",
  reconnecting: "bg-blue-100 text-blue-800",
  disconnected: "bg-slate-200 text-slate-700",
  error: "bg-red-100 text-red-800"
};

export const StatusPill = ({ status }: { status: ConnectionStatus }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${palette[status]}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {status}
  </span>
);
