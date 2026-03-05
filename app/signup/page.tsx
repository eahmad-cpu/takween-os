import { Suspense } from "react";
import SignupClient from "./signup-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={<div className="text-muted-foreground">جارٍ التحميل...</div>}
    >
      <SignupClient />
    </Suspense>
  );
}
