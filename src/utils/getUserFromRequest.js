import jwt from "jsonwebtoken";

export const getUserFromRequest = (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    console.log(
      "[getUserFromRequest] Auth header:",
      authHeader ? `${authHeader.substring(0, 50)}...` : "missing"
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error(
        "[getUserFromRequest] Authorization header is missing or invalid"
      );
      throw new Error("Authorization header is missing or invalid");
    }

    const token = authHeader.split(" ")[1]; // Extract the token
    console.log(
      "[getUserFromRequest] Extracted token:",
      token ? `${token.substring(0, 50)}...` : "null"
    );
    console.log(
      "[getUserFromRequest] JWT_SECRET exists:",
      !!process.env.JWT_SECRET
    );

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // Verify and decode the token
    console.log(
      "[getUserFromRequest] Token verified successfully. UserId:",
      decodedToken.userId
    );

    if (!decodedToken || !decodedToken.userId) {
      console.error("[getUserFromRequest] Token missing userId:", decodedToken);
      throw new Error("Invalid token");
    }

    return { userId: decodedToken.userId }; // Return the user ID from the token
  } catch (error) {
    console.error(
      "[getUserFromRequest] Error retrieving user from request:",
      error.message
    );
    console.error("[getUserFromRequest] Error details:", error);
    return null;
  }
};
