import crypto from "crypto";
// import redis from "../../../libs/redis";
import { sendEmail } from "./sendMail";
import { NextFunction, Request, Response} from "express";
// import prisma from "@packages/libs/prisma";
import { ValidationError } from "../error-handler";
import redis from "../libs/redis";
import User from "../models/User";


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateRegistrationData = (
    data: any,
    userType: "user" | "seller"
  ) => {
    const { fullName, email, password } = data;

    if (
      !fullName ||
      !email ||
      !password 
      
    ) {
      throw new ValidationError(`Missing required fields!`);
    }

    if (!emailRegex.test(email)) {
      throw new ValidationError("Invalid email format!");
    }
  };


  export const checkOtpRestrictions = async (email:string,next:NextFunction) => {
    if(await redis.get(`otp_lock:${email}`)){
        throw new ValidationError("Account is Locked due to multiple failed attempts! Please Try Again After 30 minutes")
    }

    if (await redis.get(`otp_spam_lock:${email}`)) {
        throw new ValidationError("Too Many OTP requests! Please wait an hour before requesting again");
    }

    if (await redis.get(`otp_cooldown:${email}`)) {
        throw new ValidationError("Please wait 1 minute before requesting a new OTP!");
    }
  };


  export const trackOtpRequests = async(email:string,next:NextFunction)=>{
    const otpRequestKey = `otp_request_count:${email}`;
    let otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");
    if(otpRequests >= 2 ){
        await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600); // Lock for 1 hour
        throw new ValidationError("Too many OTP request . please wait 1 hour before requesting again");
    }

    await redis.set(otpRequestKey,otpRequests + 1, "EX", 60); // Counter lasts for 1 minute
  };

  export const sendOtp = async (username:string, email:string, template: string) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    await sendEmail(email, "Verify Your Email", template, {username, otp});
    await redis.set(`otp:${email}`, otp, "EX", 300); // OTP valid for 5 minutes
    await redis.set(`otp_cooldown:${email}`, "true", "EX", 30); // 30-Second cooldown

  };

  export const verifyOtp = async (email:string, otp:string) => {
    const storedOtp = await redis.get(`otp:${email}`);
    if(!storedOtp){
      throw new ValidationError("Invalid of Expired OTP");
    }
    const failedAttemptsKey = `otp_attempts:${email}`;
    const failedAttempts = parseInt((await redis.get(failedAttemptsKey)) || "0")

    if(storedOtp !== otp){
      if(failedAttempts >= 2){
        await redis.set(`otp_lock:${email}`, "locked", "EX", 1800); // Lock for 30 minutes
        await redis.del(`otp:${email}`, failedAttemptsKey);
        throw new ValidationError(
          "Too many failed attempts. Your account is locked for 30 minutes!"
        );
      }
      await redis.set(failedAttemptsKey, failedAttempts + 1, "EX", 300);
      throw new ValidationError(
        `Incorrect OTP. ${2 - failedAttempts} attempts left.`
      );
    }
    await redis.del(`otp:${email}`, failedAttemptsKey);
  };

  export const handleForgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
    userType: "user" | "seller"
  ) => {
    try {
      const { email } = req.body;

      if (!email) throw new ValidationError("Email is required!");

      // Find user in DB
    const user = await User.findOne({ email }).exec();

  if (!user) throw new ValidationError(`${userType} not found!`);

  // Check otp restrictions
  await checkOtpRestrictions(email, next);
  await trackOtpRequests(email, next);

   // Generate OTP and send Email
   await sendOtp(
    user.fullName,
    email,
    userType === "user"
      ? "forgot-password-user-mail"
      : "forgot-password-seller-mail"
  );

  res
    .status(200)
    .json({ message: "OTP sent to email. Please verify your account." });
} catch (error) {
  next(error);
}
};

export const verifyForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      throw new ValidationError("Email and OTP are required!");

    await verifyOtp(email, otp);

    res
      .status(200)
      .json({ message: "OTP verified. You can now reset your password." });
  } catch (error) {
    next(error);
  }
};
