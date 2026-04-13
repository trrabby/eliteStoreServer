import { NextFunction, Request, Response, Router } from "express";
import { voteValidation } from "./vote.validation";
import auth from "../../middlewares/auth";
import { Role } from "@prisma/client";
import { voteController } from "./vote.controller";
import validateRequest from "../../middlewares/validateRequest";

const router = Router();

router.post(
  "/create-vote",
  auth(Role.USER, Role.ADMIN),
  validateRequest(voteValidation.createVote),
  voteController.createVote
);

router.get("/", voteController.getVotes);

router.get("/:id", voteController.getAVote);

router.patch(
  "/update-vote/:id",
  auth(Role.USER, Role.ADMIN),
  validateRequest(voteValidation.updateVote),
  voteController.updateVote
);

router.delete(
  "/delete-vote/:id",
  auth(Role.USER, Role.ADMIN),
  voteController.deleteVote
);

export const voteRouters = router;
