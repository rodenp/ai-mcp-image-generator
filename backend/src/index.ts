
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors'; // Still imported but its app.use will be commented out
import { formidable, errors as FormidableErrors } from 'formidable';
import type { File, Fields, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db } from './db';
import multer from 'multer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Expects .env in project root

const app = express();
const PORT = process.env.PORT || 9003;

const allowedOrigins = ['http://localhost:9000', 'http://127.0.0.1:9000'];
const frontendBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL;
if (frontendBaseUrl) {
  allowedOrigins.push(frontendBaseUrl);
}

const UPLOAD_DIR = path.join(__dirname, '../public/uploads/images'); // ✅ correct
console.log(`[INIT] Upload directory target: ${UPLOAD_DIR}`);
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`[INIT] Created upload directory: ${UPLOAD_DIR}`);
  } catch (err) {
    console.error(`[INIT] CRITICAL: Failed to create upload directory ${UPLOAD_DIR}`, err);
  }
} else {
  console.log(`[INIT] Upload directory already exists: ${UPLOAD_DIR}`);
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

console.log('[STATIC] Serving /uploads/images from:', UPLOAD_DIR);
app.use('/uploads/images', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 👈 critical for <img> CORS

  next();
}, express.static(UPLOAD_DIR));

console.log('[INIT] Allowed Origins:', allowedOrigins);

// --- BEGIN VERY EARLY MANUAL LOGGER AND CORS HANDLER ---
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[VERY_EARLY_MIDDLEWARE] Path: ${req.path}, Method: ${req.method}, Origin: ${req.headers.origin}`);
  
  // Manually set permissive CORS headers
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin && allowedOrigins.includes('*')) { // Or allow all if configured, for simplicity in debugging
     res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // If origin is not present or not in allowedOrigins, we might not set ACAO, 
    // or set it to a default if that's desired. For now, be explicit.
    // If no origin is matched, Access-Control-Allow-Origin might not be set, leading to CORS error for cross-origin.
    // For same-origin or direct access (like healthz), this is fine.
    // Let's be very permissive for debugging and allow the specific frontend URL if present.
    if (frontendBaseUrl) { // Fallback to defined frontend if origin header missing/mismatched
        res.setHeader('Access-Control-Allow-Origin', frontendBaseUrl);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Most permissive if nothing else matches
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    console.log('[VERY_EARLY_MIDDLEWARE] Responding to OPTIONS request with 204');
    return res.sendStatus(204); // OK, No Content
  }
  next();
});

// Middleware to log and handle requests to /upload-image path
app.all('/upload-image', (req: Request, res: Response, next: NextFunction) => {
  console.log(`[UPLOAD_IMAGE_LOGGER] Path: ${req.path}, Method: ${req.method}`);
  if (req.method === 'GET') {
    console.log('[UPLOAD_IMAGE_LOGGER] Responding to GET request.');
    return res.status(200).send('GET request to /upload-image received by logger.');
  }
  next(); 
});

// Add a simple health check route
app.get('/healthz', (req: Request, res: Response) => {
  console.log('[HEALTHZ] Received request');
  res.status(200).send('OK');
});

// --- END VERY EARLY MANUAL LOGGER AND CORS HANDLER ---

const corsOptions = {
  origin: allowedOrigins,
//  methods: ['GET', 'POST', 'OPTIONS'],
//  allowedHeaders: ['Content-Type', 'Authorization'],
//  credentials: true,
//  preflightContinue: false,
//  optionsSuccessStatus: 204 // For OPTIONS preflight
};
// Global CORS middleware
app.use(cors(corsOptions));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/\s+/g, '_');
    const uniqueName = `${timestamp}-${sanitized}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage }); // ✅ now you'll get req.file.filename

app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const protocol = req.protocol;
    const host = req.get('host');
    const storageUrl = `${protocol}://${host}/uploads/images/${filename}`;

    if (db.type === 'postgres') {
      const result = await db.postgresPool!.query(
        'INSERT INTO images (storage_url, prompt) VALUES ($1, $2) RETURNING id, storage_url, prompt, created_at',
        [storageUrl, prompt]
      );

      const row = result.rows[0];
      res.json({
        success: true,
        id: row.id,
        storageUrl: row.storage_url,
        prompt: row.prompt,
        createdAt: row.created_at,
      });

    } else if (db.type === 'mongodb') {
      const client = db.mongoClient!;
      await client.connect();

      const dbName = process.env.MONGODB_DB_NAME; // not MONGODB_URL
      const images = client.db(dbName).collection('images');

      const now = new Date();
      const insertResult = await images.insertOne({
        storage_url: storageUrl,
        prompt,
        created_at: now,
      });

      res.json({
        success: true,
        id: insertResult.insertedId,
        storageUrl: storageUrl,
        prompt: prompt,
        createdAt: now,
      });

    } else {
      throw new Error(`Unsupported DB_TYPE: ${db.type}`);
    }

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[GLOBAL_ERROR_HANDLER] Unhandled error:', err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`[INIT] Backend server is running on http://localhost:${PORT}`);
  console.log(`[INIT] CORS allowedOrigins (used by VERY_EARLY_MIDDLEWARE logic)=${allowedOrigins.join(', ')}`);
  console.log(`[INIT] Expecting uploads to be saved in: ${UPLOAD_DIR}`);
  if (frontendBaseUrl) {
    console.log(`[INIT] Frontend should be running on http://localhost:9000 or ${frontendBaseUrl} to connect.`);
  } else {
    console.log('[INIT] Frontend target URL (NEXT_PUBLIC_FRONTEND_BASE_URL) is not set in .env. Only localhost will be allowed by CORS if not manually added.');
  }
});
