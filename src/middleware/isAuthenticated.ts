// import prisma from "../libs/prisma";
import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const isAuthenticated = async (req: any, res: Response, next: NextFunction) => {
  try {


    const token =
      req.cookies["access_token"] ||
      req.cookies["seller_access_token"] ||
      req.headers.authorization?.split(" ")[1];


    if (!token) {
      return res.status(401).json({ message: "Unauthorized! Your Token missing." });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
      id: string;
      role: "user" | "seller" | "admin";
    };

    if (!decoded) {
      return res.status(401).json({
        message: "Unauthorized! Invalid token.",
      });
    }

    let account;

    if (decoded.role === "user" || decoded.role === "admin") {
      account = await User.findById(decoded.id).select("-password");
      // account = await prisma.users.findUnique({
      //   where: { id: decoded.id },
      // });
      req.user = account;
    } 

    if (!account) {
      return res.status(401).json({ message: "Account not found!" });
    }

    req.role = decoded.role;

    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized! Token expired or invalid.", error });
  }
};

export default isAuthenticated;
