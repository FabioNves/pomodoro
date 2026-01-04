export async function POST() {
  return new Response(
    JSON.stringify({
      error: "Gone",
      message: "Google Tasks synchronization has been removed.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
}
