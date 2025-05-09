
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // For local development or environments where the file path is set
      serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
      throw new Error('Firebase Admin SDK credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    // Log the error but don't re-throw if it's about already initialized,
    // which can happen with Next.js hot-reloading in dev.
    if (!/already exists/i.test(error.message)) {
       // console.error('Critical Firebase Admin SDK initialization error:', error);
       // throw error; // Or handle more gracefully depending on your app's needs
    }
  }
}

export default admin;
