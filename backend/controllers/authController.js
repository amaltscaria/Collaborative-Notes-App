// backend/controllers/authController.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    // ← Added 'return'
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      // ← Added 'await'
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or username already exists",
      });
    }

    const newUser = new User({
      username,
      email,
      password,
    });

    const user = await newUser.save();

    // Generate token
    const token = generateToken(user._id);

    // Cookie approach (commented out)
    // res.cookie('token', token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    //   maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    // });

    // Bearer token approach
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user,
        token, // ← Send token in response
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }); // ← Added 'await'

    if (!user) {
      return res.status(401).json({
        success: false, // ← Fixed: was 'true'
        message: "Invalid credentials",
      });
    }

    // Check password using schema method
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Cookie approach (commented out)
    // res.cookie('token', token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    //   maxAge: 7 * 24 * 60 * 60 * 1000
    // });

    // Bearer token approach
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token, // ← Send token in response
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
