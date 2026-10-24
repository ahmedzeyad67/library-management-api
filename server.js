import "dotenv/config";
import { connect } from "mongoose";
import app from "./app.js";
import startScheduledJobs from "./jobs/scheduled-jobs.js";

const uri = process.env.MONGO_URI;
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await connect(uri);
    console.log("Connected to MongoDB");

    startScheduledJobs();

    app.listen(port, () => {
      console.log("Server is running on port", port);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
}

startServer();
