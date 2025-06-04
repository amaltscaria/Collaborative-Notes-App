import express from "express";
import { getMe, login, register } from "../controllers/authController";
import auth from "../middleware/auth";
const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", register);

// @route   POST /api/auth/login
// @desc    Login
// @access  Public
router.post("/login", login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get("/me", auth, getMe);


export default router;