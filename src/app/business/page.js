"use client";

// Business moved under Operations. Older links (?b= / ?phase= / ?item=) are
// sent there with their query kept, so they still open the same place.

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLoader from "@/components/brand/BrandLoader";

function BusinessRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "business");
    router.replace(`/operations?${params.toString()}`);
  }, [router, searchParams]);

  return <BrandLoader screen />;
}

export default function BusinessPage() {
  return (
    <Suspense fallback={<BrandLoader screen />}>
      <BusinessRedirect />
    </Suspense>
  );
}
