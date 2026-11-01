"use client";
// A toast needs a click, so this small part of the style guide runs in the browser.
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo({ label, message }: { label: string; message: string }) {
  return (
    <Button variant="outline" onClick={() => toast.success(message)}>
      {label}
    </Button>
  );
}
