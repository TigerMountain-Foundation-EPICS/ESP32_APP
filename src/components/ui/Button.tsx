import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  block?: boolean;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-white border-accent hover:bg-blue-700",
  secondary: "bg-white text-slate-800 border-border hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 border-transparent hover:bg-slate-100",
  danger: "bg-red-600 text-white border-red-600 hover:bg-red-700"
};

export const Button = ({
  className = "",
  variant = "primary",
  block = false,
  ...props
}: ButtonProps) => (
  <button
    className={`rounded-xl border px-4 py-2 text-sm font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
      variants[variant]
    } ${block ? "w-full" : ""} ${className}`}
    {...props}
  />
);
