import { HTMLAttributes } from "react";

export const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rounded-2xl border border-border bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 ${className}`}
    {...props}
  />
);
