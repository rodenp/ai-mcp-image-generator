
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { formidable, errors as FormidableErrors } from 'formidable';
import type { File } from 'formidable';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 9003;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:9002', 'http://127.0.0.1:9002'], // Allow frontend origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight OPTIONS requests
app.options('/upload-image', cors());


// Ensure the upload directory exists. Assumes backend is run from 'backend' directory.
// Adjust if running from project root or elsewhere.
const UPLOAD_DIR = path.resolve(process.cwd(), '../public/uploads/images');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload directory: ${UPLOAD_DIR}`);
} else {
  console.log(`Upload directory already exists: ${UPLOAD_DIR}`);
}

async function parseFormData(req: Request): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
      uploadDir: UPLOAD_DIR, 
    });
    form.parse(req, (err, fields, files) => {
      if (err) {
        if (err.code === FormidableErrors.biggerThanTotalMaxFileSize || err.code === FormidableErrors.biggerThanMaxFileSize) {
          return reject(new Error('File size exceeds the 10MB limit.'));
        }
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

app.post('/upload-image', async (req: Request, res: Response) => {
  try {
    const { files } = await parseFormData(req);
    
    const imageFile = files.image?.[0] as File | undefined;

    if (!imageFile) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const originalFileName = imageFile.originalFilename || 'uploaded_image';
    const fileExtension = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, fileExtension);
    const uniqueFileName = `${baseName}_${uniqueSuffix}${fileExtension}`;
    
    const oldPath = imageFile.filepath; 
    const newPath = path.join(UPLOAD_DIR, uniqueFileName);

    fs.renameSync(oldPath, newPath);

    // This URL is relative to the Next.js public folder
    const publicUrl = `/uploads/images/${uniqueFileName}`;

    return res.status(200).json({ storageUrl: publicUrl });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    let errorMessage = 'Failed to upload image.';
    if (error.message.includes('File size exceeds')) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({ error: errorMessage, details: error.message });
  }
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log(`Expecting uploads to be saved in: ${UPLOAD_DIR}`);
  console.log(`Frontend should be running on http://localhost:9002 to connect.`);
});
