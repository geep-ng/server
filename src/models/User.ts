import mongoose from "mongoose";

// type EducationLevel = "B.Sc." | "M.Sc." | "Ph.D." | "HND" | "OND" | "Other";



const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  fullName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, },
  phoneNumber: { type: String, unique: true, trim: true },

  // Location Details
  country: { type: String, default: "Nigeria" },
  state: { type: String,  trim: true },
  city: { type: String,  trim: true },

  // Education Details (Crucial for Graduate Mobilization)
  educationLevel: { 
    type: String, 
    
    enum: ["B.Sc.", "M.Sc.", "Ph.D.", "HND", "OND", "Other"],
  },
  institution: { type: String,  trim: true },
  discipline: { type: String,  trim: true },
  yearOfGraduation: { 
    type: Number, 
    min: 1980,
    max: new Date().getFullYear() + 5 // Allows for future graduates
  },

  // GEEP-Specific Mobilization Field
  politicalInterests: { type: String, trim: true },

  // Display Picture
  // This stores the path (e.g., S3 URL or local file system path) to the uploaded image.
  displayPicturePath: { type: String, default: null }, 
  isProfileComplete: { type: Boolean, default: false },
  
}, {
    timestamps: true,
});

const User = mongoose.model("User", userSchema);

export default User;