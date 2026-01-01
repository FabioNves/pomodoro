// Helper function to decode the JWT token
export const decodeJwt = (token) => {
  console.log(
    "[decodeJwt] Attempting to decode token:",
    token ? `${token.substring(0, 50)}...` : "null/undefined"
  );

  if (!token) {
    console.error("[decodeJwt] Token is undefined or empty");
    throw new Error("Invalid token: Token is undefined or empty");
  }

  const parts = token.split(".");
  console.log("[decodeJwt] Token parts count:", parts.length);

  if (parts.length !== 3) {
    console.error(
      "[decodeJwt] Invalid token structure. Parts:",
      parts.map((p) => p.substring(0, 20))
    );
    throw new Error("Invalid token: Token must have three parts");
  }

  try {
    const base64Url = parts[1];
    console.log("[decodeJwt] Base64Url part:", base64Url.substring(0, 50));

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );

    console.log(
      "[decodeJwt] Decoded JSON payload:",
      jsonPayload.substring(0, 100)
    );
    const parsed = JSON.parse(jsonPayload);
    console.log(
      "[decodeJwt] Successfully decoded token for user:",
      parsed.email || parsed.sub || "unknown"
    );

    return parsed;
  } catch (error) {
    console.error("[decodeJwt] Error decoding JWT:", error);
    console.error("[decodeJwt] Token that failed:", token);
    throw new Error(`Failed to decode JWT: ${error.message}`);
  }
};
