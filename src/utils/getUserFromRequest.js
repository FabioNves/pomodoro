import jwt from "jsonwebtoken";

export const getUserFromRequest = (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Authorization header is missing or invalid");
    }

    const token = authHeader.split(" ")[1]; // Extract the token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // Verify and decode the token

    if (!decodedToken || !decodedToken.userId) {
      throw new Error("Invalid token");
    }

    return { userId: decodedToken.userId }; // Return the user ID from the token
  } catch (error) {
    console.error("Error retrieving user from request:", error);
    return null;
  }
};
