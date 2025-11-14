import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "zorah/kyc",
      allowed_formats: ["jpg", "png", "jpeg", "pdf"],
      public_id: `${file.fieldname}-${Date.now()}`, // Fixed typo: pubic_id → public_id
    };
  },
});

export const upload = multer({ storage });