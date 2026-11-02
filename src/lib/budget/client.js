// Browser-side helper for the Personal Budget API. Same contract as the
// Business one (session token as a Bearer header, the server's message on a
// non-2xx answer), so it is that helper under the budget's name.

export { businessApi as budgetApi } from "@/lib/business/client";
