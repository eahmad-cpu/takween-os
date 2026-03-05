import { Suspense } from "react";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={<div className="text-muted-foreground">جارٍ التحميل...</div>}
    >
      <LoginClient />
    </Suspense>
  );
}
