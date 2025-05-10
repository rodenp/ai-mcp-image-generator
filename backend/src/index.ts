
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors'; // Still imported but its app.use will be commented out
import { formidable, errors as FormidableErrors } from 'formidable';
import type { File, Fields, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Expects .env in project root

const app = express();
const PORT = process.env.PORT || 9003;

const allowedOrigins = ['http://localhost:9000', 'http://127.0.0.1:9000'];
const frontendBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL;
if (frontendBaseUrl) {
  allowedOrigins.push(frontendBaseUrl);
}

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

const UPLOAD_DIR = path.resolve(process.cwd(), '../public/uploads/images');
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

// SIMPLIFIED POST HANDLER FOR /upload-image
app.post('/upload-image', async (req: Request, res: Response) => {
  console.log('[UPLOAD_IMAGE_HANDLER_SIMPLE] Received POST request. Responding OK.');
  res.status(200).json({ message: 'Simplified POST received' });
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
