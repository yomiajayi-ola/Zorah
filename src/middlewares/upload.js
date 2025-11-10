import multer from "multer";
import { cloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";

const storage = new cloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        return {
            folder: "zorah/kyc",
            allowed_formats: ["jpg", "png", "jpeg", "pdf"],
            pubic_id: `${file.fieldname}-${Date.now}`,
        };
    },
});

export const upload = multer({ storage });