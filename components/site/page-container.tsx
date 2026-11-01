// The frame every page puts its content in: centred, same width and side margins everywhere.
import { cn } from "cn";

export function PageContainer({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="page-container"
      className={cn("mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6", className)}
      {...props}
    />
  );
}
