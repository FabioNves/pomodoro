import { decodeJwt } from "../utils/jwtUtils";

let googleAuth;

export const loadGoogleIdentityServices = () => {
  return new Promise((resolve, reject) => {
    if (window.google) {
      resolve();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("Failed to load Google Identity Services script"));
      document.body.appendChild(script);
    }
  });
};

export const initializeGoogleAuth = async (onLogin) => {
  try {
    await loadGoogleIdentityServices();

    googleAuth = window.google.accounts.id;
    googleAuth.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, // Use env variable
      callback: (response) => {
        console.log("Google Sign-In Callback Received:", response); // Add log
        try {
          // Add try block here
          const user = decodeJwt(response.credential);
          console.log("Decoded User:", user); // Add log
          if (onLogin) {
            onLogin(user); // Pass user data to the callback
          }
        } catch (error) {
          // Add catch block here
          console.error("Error processing Google Sign-In callback:", error);
        }
      },
    });

    console.log("Google Auth Initialized"); // Add log
  } catch (error) {
    console.error("Error initializing Google Identity Services:", error);
  }
};

export const signInWithGoogle = () => {
  console.log("signInWithGoogle called"); // Add log
  if (googleAuth) {
    console.log("Calling googleAuth.prompt()"); // Add log
    googleAuth.prompt(); // Show the sign-in prompt on button click
  } else {
    console.error("Google Auth is not initialized yet"); // Add log
  }
};

export const signOutFromGoogle = (setUser) => {
  localStorage.removeItem("accessToken"); // Remove the JWT
  setUser(null); // Clear the user state
};

const jwt = require("jsonwebtoken");

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET ||
      process.env.NEXT_PUBLIC_JWT_REFRESH_SECRET ||
      "REFRESH_SECRET",
    {
      expiresIn: "3d",
    }
  );
  return { accessToken, refreshToken };
};

export const refreshAccessToken = async () => {
  try {
    const response = await fetch("/api/auth", {
      method: "PUT",
      credentials: "include",
    });
    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem("accessToken", accessToken); // Store the new access token
      return accessToken;
    } else {
      throw new Error("Failed to refresh access token");
    }
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return null;
  }
};

export const getAccessToken = async () => {
  let token = localStorage.getItem("accessToken");
  if (!token) {
    token = await refreshAccessToken();
  }
  return token;
};
