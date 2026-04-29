"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--background)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        },
        classNames: {
          success:
            "!border-emerald-200 !bg-emerald-50 !text-emerald-900 [&_svg]:text-emerald-600",
          error:
            "!border-red-200 !bg-red-50 !text-red-900 [&_svg]:text-red-600",
          info:
            "!border-sky-200 !bg-sky-50 !text-sky-900 [&_svg]:text-sky-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
