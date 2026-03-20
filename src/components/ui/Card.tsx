import { HTMLAttributes } from "react";

export const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-card backdrop-blur-sm transition duration-200 ${className}`}
    {...props}
  />
);
