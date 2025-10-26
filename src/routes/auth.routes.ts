import express, { Router } from "express";
import {
  loginUser,
  userRegistration,
  verifyUser,
  userForgotPassword,
  resetUserPassword,
  verifyUserForgotPassword,
  // refreshToken,
  getUser,
  handleRefreshToken,
  updateUserPassword,
  completeProfile,
  uploadMiddleware,
  uploadProfileImage,
} from "../controller/auth.controller";
import isAuthenticated from "../middleware/isAuthenticated";

const router: Router = express.Router();


// --- AUTHENTICATION FLOW ---
router.post("/login-user", loginUser);
router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/refresh-token", handleRefreshToken);
router.post("/forgot-password-user", userForgotPassword);
router.post("/reset-password-user", resetUserPassword);
router.post("/verify-forgot-password-user", verifyUserForgotPassword);

// --- PROTECTED ROUTES ---
// Assuming 'isAuthenticated' is a middleware that verifies tokens and sets req.user
router.get("/logged-in-user", isAuthenticated, getUser);
router.post("/change-password", isAuthenticated, updateUserPassword);

// --- NEW PROFILE COMPLETION ROUTE ---
router.post('/upload-profile-image', isAuthenticated, uploadMiddleware, uploadProfileImage);
router.post("/complete-profile", isAuthenticated, completeProfile);

export default router;