import type { SVGProps } from "react";

export function Isotipo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1878 2017"
      fill="currentColor"
      role="img"
      aria-label="Devsoul"
      className={className ?? "h-8 w-auto text-acento-lima"}
      {...props}
    >
      <path d="M0 0H1878L1482 402H941L1482 1008L585 2017H0L895 1008Z" />
      <path d="M0 707L266 1008L0 1306Z" />
    </svg>
  );
}
