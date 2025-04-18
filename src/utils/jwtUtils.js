// Helper function to decode the JWT token
export const decodeJwt = (token) => {
  if (!token) {
    throw new Error("Invalid token: Token is undefined or empty");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token: Token must have three parts");
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding JWT:", error);
    throw new Error("Failed to decode JWT");
  }
};
