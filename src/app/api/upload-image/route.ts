
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import admin from '@/lib/firebase/firebaseAdmin'; // Ensures admin is initialized
import { formidable, errors as FormidableErrors } from 'formidable';
import type { File } from 'formidable';
import fs from 'fs'; // Required for reading the temporary file path

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing, formidable will handle it
  },
};

async function parseFormData(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  const formidableReq = req as any; // Cast to any to satisfy formidable's expected request type
  return new Promise((resolve, reject) => {
    const form = formidable({ 
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        keepExtensions: true,
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
    if (!admin.apps.length) {
      // This is a fallback, should ideally be initialized globally as in firebaseAdmin.ts
      console.warn("Firebase Admin SDK not initialized in API route, attempting init.");
      // Potentially re-run init logic here or ensure firebaseAdmin.ts is always imported top-level
    }
    
    const { files } = await parseFormData(req);
    
    const imageFile = files.image?.[0] as File | undefined;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const bucket = admin.storage().bucket();
    const fileName = `images/${Date.now()}_${imageFile.originalFilename || 'uploaded_image'}`;
    
    // formidable saves files to a temporary path. We need to use this path for uploading.
    const filePath = imageFile.filepath; 

    await bucket.upload(filePath, {
      destination: fileName,
      metadata: {
        contentType: imageFile.mimetype || 'application/octet-stream',
      },
    });

    // Make the file public (alternatively, generate a signed URL)
    const file = bucket.file(fileName);
    await file.makePublic();
    const publicUrl = file.publicUrl();

    // Optionally, clean up the temporary file if formidable doesn't do it automatically
    // fs.unlinkSync(filePath); // Check formidable docs for cleanup behavior

    return NextResponse.json({ storageUrl: publicUrl });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    let errorMessage = 'Failed to upload image.';
    if (error.message.includes('File size exceeds')) {
        errorMessage = error.message;
    } else if (error.code === 'storage/object-not-found' && error.message.includes("does not have storage.objects.create access")) {
        errorMessage = "Permission denied. Check Firebase Storage rules and service account permissions.";
    } else if (error.message.includes('Firebase Admin SDK credentials not found') || error.message.includes('Must initialize App')) {
        errorMessage = "Firebase Admin SDK not configured correctly. Check server logs and environment variables.";
    }
    
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
