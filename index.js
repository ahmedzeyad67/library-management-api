import "dotenv/config";
import express from "express";
import cors from "cors";
import { connect } from "mongoose";
import authRouter from "./routers/auth-router.js";
import booksRouter from "./routers/book-router.js";
import usersRouter from "./routers/user-router.js";
import reservationsRouter from "./routers/reservation-router.js";
import loansRouter from "./routers/loan-router.js";
import errorHandler from "./middlewares/error-handler.js";

const app = express();
app.use(express.json());
app.use(cors());

const uri = process.env.MONGO_URI;
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await connect(uri);
    console.log("Connected to MongoDB");

    app.listen(port, () => {
      console.log("Server is running on port", port);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();

app.use("/api/auth", authRouter);
app.use("/api/books", booksRouter);
app.use("/api/users", usersRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/loans", loansRouter);

app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

app.use(errorHandler);
