import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

function srvToDirectUri(srvUri) {
  // Convert mongodb+srv://user:pass@host/... to direct mongodb:// with known shard hosts
  const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(.*)/);
  if (!match) return null;
  const [, credentials, srvHost, rest] = match;
  const baseDomain = srvHost.replace(/^[^.]+\./, "");
  const hosts = [
    `${srvHost.replace(/^[^.]+/, srvHost.split(".")[0] + "-shard-00-00")}:27017`,
    `${srvHost.replace(/^[^.]+/, srvHost.split(".")[0] + "-shard-00-01")}:27017`,
    `${srvHost.replace(/^[^.]+/, srvHost.split(".")[0] + "-shard-00-02")}:27017`,
  ];
  const params = rest.includes("?")
    ? rest.replace("?", "?ssl=true&authSource=admin&")
    : "?ssl=true&authSource=admin";
  return `mongodb://${credentials}@${hosts.join(",")}${params}`;
}

export const connectToDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "pomodoro-app",
    });
    isConnected = true;
    console.log("MongoDB Connected");
  } catch (err) {
    // If SRV resolution fails, try direct connection
    if (
      process.env.MONGO_URI?.startsWith("mongodb+srv://") &&
      (err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("querySrv"))
    ) {
      console.warn("SRV lookup failed, trying direct connection...");
      const directUri = srvToDirectUri(process.env.MONGO_URI);
      if (directUri) {
        try {
          await mongoose.connect(directUri, { dbName: "pomodoro-app" });
          isConnected = true;
          console.log("MongoDB Connected (direct fallback)");
          return;
        } catch (fallbackErr) {
          console.error("Direct fallback also failed:", fallbackErr);
          throw fallbackErr;
        }
      }
    }
    console.error("MongoDB connection error:", err);
    throw err;
  }
};
