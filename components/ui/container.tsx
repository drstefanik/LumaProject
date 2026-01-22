import type { HTMLAttributes } from "react";

const baseClasses = "mx-auto w-full max-w-6xl px-6 md:px-8";

type ContainerProps = HTMLAttributes<HTMLDivElement>;

export function Container({ className, ...props }: ContainerProps) {
  return (
    <div className={[baseClasses, className].filter(Boolean).join(" ")} {...props} />
  );
}
