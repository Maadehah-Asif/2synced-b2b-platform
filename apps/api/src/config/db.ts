// src/config/db.ts
import mongoose from "mongoose";
import { ENV } from "./env.js";

export async function connectDB() {
  // Build the connection URI robustly: avoid double slashes when MONGO_URI ends with '/'
  const baseUri = ENV.MONGO_URI.replace(/\/+$/, "");
  const uri = `${baseUri}/${ENV.DB_NAME}?retryWrites=true&w=majority`;
  // Attach basic connection event listeners so runtime state is visible
  // do not log 'connected' on the event; we'll confirm connectivity with a ping after connect()
  mongoose.connection.on("error", (err) => {
    console.error("[db] mongoose event: error", err);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] mongoose event: disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[db] mongoose event: reconnected");
  });

  try {
    await mongoose.connect(uri, {
      // options are inferred in Mongoose 7+
    });

    // Double-check connection state after connect() resolves
    const ready = mongoose.connection.readyState; // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (ready === 1) {
      // Perform a lightweight ping to ensure the server is reachable and the namespace is valid
      try {
        // admin ping will throw if the server is not reachable or namespace is invalid
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const admin = (mongoose.connection.db as any).admin();
        // admin.ping returns { ok: 1 } on success
        const pong = await admin.ping();
        if (pong && pong.ok === 1) {
          console.log("[db] connected");
        } else {
          console.error("[db] ping failed:", pong);
          process.exit(1);
        }
      } catch (e) {
        console.error("[db] ping error:", e);
        process.exit(1);
      }
    } else {
      console.error("[db] not connected after mongoose.connect — readyState=", ready);
      process.exit(1);
    }
  } catch (err) {
    console.error("[db] connection error:", err);
    process.exit(1); // hard exit on startup failure
  }
}
