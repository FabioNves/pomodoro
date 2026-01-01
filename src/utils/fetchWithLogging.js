// Wrapper for fetch that logs authentication headers
export const fetchWithLogging = async (url, options = {}) => {
  const authHeader =
    options.headers?.Authorization || options.headers?.authorization;

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    console.log(`[fetchWithLogging] API call to ${url}`);
    console.log(
      `[fetchWithLogging] Token being sent:`,
      token ? `${token.substring(0, 50)}...` : "null"
    );

    // Validate token structure before sending
    if (token && token !== "null" && token !== "undefined") {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error(
          `[fetchWithLogging] ❌ INVALID TOKEN STRUCTURE! Token has ${parts.length} parts`
        );
        console.error(
          `[fetchWithLogging] This will cause JWT decode errors on the server!`
        );
      }
    }
  } else {
    console.log(`[fetchWithLogging] API call to ${url} (no auth)`);
  }

  try {
    const response = await fetch(url, options);
    console.log(
      `[fetchWithLogging] Response from ${url}:`,
      response.status,
      response.statusText
    );
    return response;
  } catch (error) {
    console.error(`[fetchWithLogging] Error calling ${url}:`, error);
    throw error;
  }
};
