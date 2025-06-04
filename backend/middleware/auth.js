import jwt from "jsonwebtoken";
import User from "../models/User";
export default auth = async (req, res, next) => {
  try {
    let token;

    // Check for token in authorization header - set manually
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split("")[1];
      // Check for token in cookies (set automatically by browser)
    } else if (req.cookies & req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided, access denied",
      });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach to request
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.log("Auth middleware error", error);
    return res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
  }
};
