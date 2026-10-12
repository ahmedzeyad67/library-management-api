import asyncWrapper from "../middlewares/async-wrapper.js";
import userService from "../services/user-service.js";

const getAllUsers = asyncWrapper(async (req, res) => {
  const data = await userService.getAllUsers(req.query);

  res.json({
    status: "success",
    ...data,
  });
});

const updateMe = asyncWrapper(async (req, res) => {
  const updatedUser = await userService.updateMe(req.user.id, req.body);

  res.json({ status: "success", data: { user: updatedUser } });
});

const activateUser = asyncWrapper(async (req, res) => {
  const user = await userService.activateUser(req.params.userId);

  res.json({ status: "success", data: user });
});

const deactivateUser = asyncWrapper(async (req, res) => {
  const user = await userService.deactivateUser(req.params.userId);

  res.json({ status: "success", data: user });
});

export default {
  getAllUsers,
  updateMe,
  deactivateUser,
  activateUser,
};
