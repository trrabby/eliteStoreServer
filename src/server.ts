import { Server } from "http";
import app from "./app";
import config from "./config";
import { initSocket } from "./config/socket";

async function main() {
  try {
    const httpServer: Server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });

    // initialize socket.io
    const io = initSocket(httpServer);
    console.log("Socket.io initialized");
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

main().catch(console.error);
