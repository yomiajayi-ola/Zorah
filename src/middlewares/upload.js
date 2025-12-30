import { S3Client } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";

dotenv.config();

// Initialize the S3 Client with your credentials
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure Multer to use S3 Storage
const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME,
  // Optional: Make the file publicly accessible via URL
  // acl: 'public-read', 
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    // This defines the path inside your S3 bucket
    const folder = "zorah/kyc";
    const fileName = `${file.fieldname}-${Date.now()}-${file.originalname}`;
    cb(null, `${folder}/${fileName}`);
  },
});

export const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});