import { NextFunction, Request, Response } from "express";
import { handleForgotPassword, validateRegistrationData } from "../utils/authHelper";
import bcrypt from "bcryptjs";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import {
  trackOtpRequests,
  checkOtpRestrictions,
  sendOtp,
  verifyForgotPasswordOtp,
  verifyOtp,
} from "../utils/authHelper";
import { setCookie } from "../utils/cookies/setCookie";
import { AuthError, ValidationError } from "../error-handler";
import User from "../models/User";
import imageKit from "../libs/imageKit";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export const uploadMiddleware = upload.single("image");

// import { name } from "ejs";

// Register a new User (send OTP)
export const userRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    validateRegistrationData(req.body, "user");
    const { fullName, email } = req.body;

    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
    await sendOtp(fullName, email, "user-activation-mail");

    res.status(200).json({
      message: "OTP sent to email. Please verify your account.",
    });
  } catch (error) {
    return next(error);
  }
};

/// Verify user with OTP + create account (Initial creation with minimal fields)
export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, password, fullName } = req.body; // Removed 'username'
    if (!email || !otp || !password) {
      return next(new ValidationError("Email, password, and OTP are required"));
    }

    const existingUser = await User.findOne({ email }).exec();
    if (existingUser && existingUser.isProfileComplete) {
      return next(new ValidationError("User already exists and is fully registered"));
    }

    await verifyOtp(email, otp);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with minimal fields. isProfileComplete defaults to false.
    // If user exists but was unverified, this logic would need to update the password/state, 
    // but for simplicity, we create a new user.
    const newUser = await User.create({fullName, email, password: hashedPassword });

    // Clear any legacy cookies
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    // ✅ Generate tokens (same as login)
    const accessToken = jwt.sign(
      { id: newUser._id, role: "user" },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15d" }
    );

    const refreshToken = jwt.sign(
      { id: newUser._id, role: "user" },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "70d" }
    );

    // ✅ Store tokens in cookies
    setCookie(res, "refresh_token", refreshToken);
    setCookie(res, "access_token", accessToken);

    res.status(201).json({
      success: true,
      message: "User registered successfully! Proceed to profile setup.",
      user: {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        // isProfileComplete will be false, triggering the client to redirect to onboarding
        isProfileComplete: newUser.isProfileComplete, 
      },
    });
  } catch (error) {
    return next(error);
  }
};



/**
 * NEW: Handles the second step of registration: profile completion.
 * Requires user to be authenticated (via isAuthenticated middleware).
 */
export const completeProfile = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // Set by isAuthenticated middleware
    const profileData = req.body;

    // Minimal validation to ensure key fields are present
    const requiredFields = [
      'fullName', 'dateOfBirth', 'phoneNumber', 'state', 'city', 
      'educationLevel', 'institution', 'discipline', 'yearOfGraduation'
    ];
    for (const field of requiredFields) {
      if (!profileData[field]) {
        return next(new ValidationError(`Missing required profile field: ${field}`));
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...profileData, // Contains all GEEP fields
        isProfileComplete: true, // Mark as complete
      },
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).exec();

    if (!updatedUser) {
      return next(new AuthError("User not found during profile update."));
    }

    res.status(200).json({
      success: true,
      message: "Profile setup complete!",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        isProfileComplete: updatedUser.isProfileComplete,
      },
    });

  } catch (error) {
    return next(error);
  }
};



// Login user
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return next(new ValidationError("Email or username and password are required"));
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).exec();

    if (!user) {
      return next(new AuthError("User doesn't exist!"));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AuthError("Invalid email/username or password"));
    }

    // Clear any legacy cookies
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    // Generate tokens
    const accessToken = jwt.sign({ id: user._id, role: "user" }, process.env.ACCESS_TOKEN_SECRET!, {
      expiresIn: "15d",
    });

    const refreshToken = jwt.sign({ id: user._id, role: "user" }, process.env.REFRESH_TOKEN_SECRET!, {
      expiresIn: "70d",
    });

    // Store tokens in cookies
    setCookie(res, "refresh_token", refreshToken);
    setCookie(res, "access_token", accessToken);

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, email: user.email, fullName: user?.fullName, isProfileComplete: user.isProfileComplete },
    });
  } catch (error) {
    return next(error);
  }
};


// Refresh token
export const handleRefreshToken = async (req: any, res: Response, next: NextFunction) => {
  try {
    const refreshToken =
      req.cookies["refresh_token"] || req.headers.authorization?.split(" ")[1];

    if (!refreshToken) {
      throw new ValidationError("Unauthorized, no refresh token!");
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
      id: string;
      role: string;
    };

    if (!decoded || !decoded.id) {
      return new JsonWebTokenError("Forbidden! Invalid refresh token");
    }

    const user = await User.findById(decoded.id).exec();
    if (!user) {
      return new AuthError("Forbidden! User not found!");
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: "user" },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "21d" }
    );

    setCookie(res, "access_token", newAccessToken);
    req.role = "user";

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

// Get logged in user (req.user is set via middleware)
export const getUser = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// Forgot password (sends OTP)
export const userForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  await handleForgotPassword(req, res, next, "user");
};

// Verify forgot password OTP
export const verifyUserForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  await verifyForgotPasswordOtp(req, res, next);
};

// Reset password
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return next(new ValidationError("Email and new password are required!"));
    }

    const user = await User.findOne({ email }).exec();
    if (!user) {
      return next(new ValidationError("User not found!"));
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return next(new ValidationError("New password cannot be the same as the old one!"));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    return next(error);
  }
};

// Update user password
export const updateUserPassword = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // set by your auth middleware
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(new ValidationError("All fields are required"));
    }

    if (newPassword !== confirmPassword) {
      return next(new ValidationError("New passwords do not match"));
    }

    if (newPassword === currentPassword) {
      return next(new ValidationError("New password cannot be the same as the current password"));
    }

    const user = await User.findById(userId).exec();
    if (!user || !user.password) {
      return next(new AuthError("User not found or password not set"));
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return next(new AuthError("Current password is incorrect"));
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};


// Upload product image
export const uploadProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const fileBuffer = req.file.buffer.toString("base64");

    const response = await imageKit.upload({
      file: fileBuffer,
      fileName: `geep-${Date.now()}.jpg`,
      folder: "users/profile-images/",
    });

    return res.status(201).json({
      message: "Image uploaded successfully",
      fileUrl: response.url,
      fileId: response.fileId,
    });
  } catch (error) {
    console.error("Image upload failed:", error);
    return next(error);
  }
};