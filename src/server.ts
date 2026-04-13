import { Server } from "http";
import app from "./app";
import config from "./config";

async function main() {
  try {
    const server: Server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

main().catch((error) => {
  console.error("Error in main function:", error);
});
