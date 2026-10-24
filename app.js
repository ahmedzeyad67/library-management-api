import express from "express";
import cors from "cors";
import authRouter from "./routers/auth-router.js";
import booksRouter from "./routers/book-router.js";
import usersRouter from "./routers/user-router.js";
import reservationsRouter from "./routers/reservation-router.js";
import loansRouter from "./routers/loan-router.js";
import errorHandler from "./middlewares/error-handler.js";
import { apiReference } from "@scalar/express-api-reference";
import openapi from "./docs/openapi.js";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/openapi.json", (req, res) => res.json(openapi));
app.use("/reference", apiReference({ spec: { content: openapi } }));

app.use("/api/auth", authRouter);
app.use("/api/books", booksRouter);
app.use("/api/users", usersRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/loans", loansRouter);

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
