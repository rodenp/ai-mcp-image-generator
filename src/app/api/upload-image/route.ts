
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formidable, errors as FormidableErrors } from 'formidable';
import type { File } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing, formidable will handle it
  },
};

// Ensure the upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'images');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function parseFormData(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  const formidableReq = req as any; 
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
      uploadDir: UPLOAD_DIR, // Temporarily save to final dir, then rename for uniqueness
    });
    form.parse(formidableReq, (err, fields, files) => {
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

export async function POST(req: NextRequest) {
  try {
    const { files } = await parseFormData(req);
    
    const imageFile = files.image?.[0] as File | undefined;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Generate a unique filename
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const originalFileName = imageFile.originalFilename || 'uploaded_image';
    const fileExtension = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, fileExtension);
    const uniqueFileName = `${baseName}_${uniqueSuffix}${fileExtension}`;
    
    const oldPath = imageFile.filepath; // Path where formidable saved the file
    const newPath = path.join(UPLOAD_DIR, uniqueFileName);

    // Rename the file to its final unique name
    fs.renameSync(oldPath, newPath);

    // Construct the public URL
    const publicUrl = `/uploads/images/${uniqueFileName}`;

    return NextResponse.json({ storageUrl: publicUrl });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    let errorMessage = 'Failed to upload image.';
    if (error.message.includes('File size exceeds')) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
