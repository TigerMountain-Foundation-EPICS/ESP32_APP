import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  block?: boolean;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border-brand-olive bg-brand-olive text-white hover:bg-[#5d7c36]",
  secondary: "border-brand-navy/10 bg-brand-cream text-brand-navy hover:bg-white",
  ghost: "border-transparent bg-white/45 text-brand-navy shadow-none hover:bg-white/75",
  danger: "border-brand-orange bg-brand-orange text-white hover:bg-[#d96e21]"
};

export const Button = ({
  className = "",
  variant = "primary",
  block = false,
  ...props
}: ButtonProps) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-extrabold tracking-[0.01em] shadow-float transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
      variants[variant]
    } ${block ? "w-full" : ""} ${className}`}
    {...props}
  />
);
