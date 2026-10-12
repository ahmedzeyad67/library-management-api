import asyncWrapper from "../middlewares/async-wrapper.js";
import loanService from "../services/loan-service.js";

const getLoans = asyncWrapper(async (req, res) => {
  const data = await loanService.getLoans(req.query, req.user);

  res.json({
    status: "success",
    ...data,
  });
});

const getLoanById = asyncWrapper(async (req, res) => {
  const loan = await loanService.getLoanById(req.params.loanId, req.user);

  res.json({ status: "success", data: loan });
});

const returnLoan = asyncWrapper(async (req, res) => {
  const loan = await loanService.returnLoan(req.params.loanId);

  res.json({ status: "success", data: loan });
});

export default {
  getLoans,
  getLoanById,
  returnLoan,
};
