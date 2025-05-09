
'use server';

import { getDbConfig, type DatabaseConfig } from '@/config/db';
import type { GalleryImage, NewGalleryImage } from './types';

// Helper function for PostgreSQL to ensure table exists
async function ensurePostgresTableInitialized(client: any): Promise<void> {
  // Note: For gen_random_uuid() to work, the pgcrypto extension might need to be enabled in PostgreSQL.
  // Execute `CREATE EXTENSION IF NOT EXISTS pgcrypto;` in your database if you encounter issues.
  // Alternatively, you can use `id SERIAL PRIMARY KEY` for a simpler auto-incrementing integer ID.
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      data_url TEXT NOT NULL,
      prompt TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  try {
    await client.query(createTableQuery);
    console.log("Table 'images' checked/created successfully.");
  } catch (err) {
    console.error("Error ensuring 'images' table exists:", err);
    throw err; // Re-throw the error to be caught by the calling function
  }
}


// Placeholder for actual PostgreSQL client and logic
async function saveImageToPostgres(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  console.log(`Attempting to save image to Postgres (URL: ${config.postgresUrl}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  console.warn('********************************************************************************************************');
  console.warn('* PostgreSQL saveImageToPostgres IS A PLACEHOLDER. USER IMPLEMENTATION NEEDED.                         *');
  console.warn('* The following example code attempts to create the table if it doesn\'t exist.                       *');
  console.warn('* For production, use proper migration tools.                                                        *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Install 'pg' package: npm install pg (or yarn add pg)
  // 2. Uncomment and adapt the following example:
  /*
  const { Client } = require('pg'); // Make sure 'pg' is in package.json
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
    await ensurePostgresTableInitialized(client); // Create table if it doesn't exist

    const res = await client.query(
      'INSERT INTO images (data_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id::text, data_url, prompt, created_at',
      [image.dataUrl, image.prompt]
    );
    return res.rows[0] as GalleryImage;
  } catch (dbError) {
    console.error("PostgreSQL save error:", dbError);
    return null;
  } finally {
    await client.end();
  }
  */
  return null; // Returning null to indicate failure/non-implementation for consistent fallback
}

async function getImagesFromPostgres(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from Postgres (URL: ${config.postgresUrl})`);
  console.warn('********************************************************************************************************');
  console.warn('* PostgreSQL getImagesFromPostgres IS A PLACEHOLDER. USER IMPLEMENTATION NEEDED.                       *');
  console.warn('* The following example code attempts to create the table if it doesn\'t exist.                       *');
  console.warn('* For production, use proper migration tools.                                                        *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Install 'pg' package: npm install pg (or yarn add pg)
  // 2. Uncomment and adapt the following example:
  /*
  const { Client } = require('pg'); // Make sure 'pg' is in package.json
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
    await ensurePostgresTableInitialized(client); // Create table if it doesn't exist

    const res = await client.query('SELECT id::text, data_url, prompt, created_at FROM images ORDER BY created_at DESC');
    return res.rows.map(row => ({...row, createdAt: new Date(row.created_at) })) as GalleryImage[];
  } catch (dbError) {
    console.error("PostgreSQL retrieval error:", dbError);
    return [];
  } finally {
    await client.end();
  }
  */
  return [];
}

// Placeholder for actual MongoDB client and logic
async function saveImageToMongo(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  console.log(`Attempting to save image to MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  console.warn('********************************************************************************************************');
  console.warn('* MongoDB saveImageToMongo IS A PLACEHOLDER AND NOT FULLY IMPLEMENTED.                                 *');
  console.warn('* No actual database save will occur. Returning null to allow localStorage fallback.                 *');
  console.warn('* USER IMPLEMENTATION NEEDED in src/lib/db/actions.ts.                                               *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Install 'mongodb' package: npm install mongodb (or yarn add mongodb)
  // 2. Uncomment and adapt the following example:
  /*
  const { MongoClient } = require('mongodb'); // Make sure 'mongodb' is in package.json
  const client = new MongoClient(config.mongodbUrl!);
  await client.connect();
  try {
    const db = client.db(config.mongodbDbName);
    const collection = db.collection('images'); // Collection will be created if it doesn't exist
    const docToInsert = { ...image, createdAt: new Date() };
    const result = await collection.insertOne(docToInsert);
    return { ...docToInsert, id: result.insertedId.toString(), createdAt: docToInsert.createdAt };
  } catch (dbError) {
    console.error("MongoDB save error:", dbError);
    return null;
  } finally {
    await client.close();
  }
  */
  return null; // Returning null to indicate failure/non-implementation for consistent fallback
}

async function getImagesFromMongo(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName})`);
  console.warn('********************************************************************************************************');
  console.warn('* MongoDB getImagesFromMongo IS A PLACEHOLDER AND NOT FULLY IMPLEMENTED.                               *');
  console.warn('* No actual database retrieval will occur. Returning empty array.                                      *');
  console.warn('* USER IMPLEMENTATION NEEDED in src/lib/db/actions.ts.                                               *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Install 'mongodb' package: npm install mongodb (or yarn add mongodb)
  // 2. Uncomment and adapt the following example:
  /*
  const { MongoClient } = require('mongodb'); // Make sure 'mongodb' is in package.json
  const client = new MongoClient(config.mongodbUrl!);
  await client.connect();
  try {
    const db = client.db(config.mongodbDbName);
    const collection = db.collection('images');
    const imagesFromDb = await collection.find().sort({ createdAt: -1 }).toArray();
    return imagesFromDb.map(doc => ({
      id: doc._id.toString(),
      dataUrl: doc.dataUrl,
      prompt: doc.prompt,
      createdAt: new Date(doc.createdAt), // Ensure createdAt is a Date object
    })) as GalleryImage[];
  } catch (dbError) {
    console.error("MongoDB retrieval error:", dbError);
    return [];
  } finally {
    await client.close();
  }
  */
  return [];
}


export async function saveImageToDb(image: NewGalleryImage): Promise<GalleryImage | null> {
  const config = getDbConfig();
  try {
    if (config.dbType === 'postgres' && config.postgresUrl) {
      return await saveImageToPostgres(image, config);
    } else if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
      return await saveImageToMongo(image, config);
    } else {
      if (config.dbType !== 'none' && config.dbType !== undefined) { // Check for undefined explicitly
        console.log(`Database type ${config.dbType} configured but missing required URL/details. Image not saved to DB.`);
      }
      // For 'none' or truly unconfigured, no specific log here, handled by caller or form.
      return null;
    }
  } catch (error) {
    console.error("Error in saveImageToDb dispatch:", error);
    return null;
  }
}

export async function getImagesFromDb(): Promise<GalleryImage[]> {
  const config = getDbConfig();
   try {
    if (config.dbType === 'postgres' && config.postgresUrl) {
      return await getImagesFromPostgres(config);
    } else if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
      return await getImagesFromMongo(config);
    } else {
       if (config.dbType !== 'none' && config.dbType !== undefined) {
        console.log(`Database type ${config.dbType} configured but missing required URL/details. Cannot fetch images from DB.`);
      }
      return [];
    }
  } catch (error) {
    console.error("Error in getImagesFromDb dispatch:", error);
    return [];
  }
}

export async function testDbConnection(): Promise<{success: boolean; message: string; dbType: string | undefined}> {
  const config = getDbConfig();
  let message = '';

  console.log(`Attempting to test DB connection for DB_TYPE: ${config.dbType}`);

  if (!config.dbType || config.dbType === 'none') {
    message = 'DB_TYPE is "none" or not set. No database connection to test.';
    console.log(message);
    return { success: true, message, dbType: config.dbType };
  }

  if (config.dbType === 'postgres') {
    if (!config.postgresUrl) {
      message = 'DB_TYPE is postgres, but POSTGRES_URL is not set.';
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    // USER IMPLEMENTATION NEEDED for actual PostgreSQL connection test
    // Example using 'pg' client:
    /*
    const { Client } = require('pg');
    const client = new Client({ connectionString: config.postgresUrl, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await ensurePostgresTableInitialized(client); // Also check/create table during test
      message = 'Successfully connected to PostgreSQL and ensured table exists.';
      console.log(message);
      await client.end();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `Failed to connect to PostgreSQL or initialize table: ${e.message}`;
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    */
    message = 'PostgreSQL connection test is a PLACEHOLDER. USER IMPLEMENTATION NEEDED. Will attempt to ensure table exists (placeholder).';
    console.warn(message);
    // Simulating the call for placeholder
    // const { Client } = require('pg'); // This would fail if pg isn't installed
    // const client = { query: async () => {} }; // Mock client
    // await ensurePostgresTableInitialized(client); 
    return { success: true, message: `${message} Assuming success for placeholder.`, dbType: config.dbType };


  } else if (config.dbType === 'mongodb') {
    if (!config.mongodbUrl || !config.mongodbDbName) {
      message = 'DB_TYPE is mongodb, but MONGODB_URL or MONGODB_DB_NAME is not set.';
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    // USER IMPLEMENTATION NEEDED for actual MongoDB connection test
    // Example using 'mongodb' client:
    /*
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.mongodbUrl!, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      message = `Successfully connected to MongoDB and database "${config.mongodbDbName}".`;
      console.log(message);
      await client.db(config.mongodbDbName).command({ ping: 1 }); // Verify connection to DB
      console.log("MongoDB ping successful.");
      // For MongoDB, collection creation is typically automatic on first insert,
      // but you could list collections to see if 'images' exists if needed.
      // const collections = await client.db(config.mongodbDbName).listCollections({ name: 'images' }).toArray();
      // if (collections.length > 0) console.log("MongoDB 'images' collection exists or is ready.");
      // else console.log("MongoDB 'images' collection will be created on first write.");
      await client.close();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `Failed to connect to MongoDB: ${e.message}`;
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    */
    message = 'MongoDB connection test is a PLACEHOLDER. USER IMPLEMENTATION NEEDED.';
    console.warn(message);
    return { success: true, message: `${message} Assuming success for placeholder.`, dbType: config.dbType };
  }

  message = `Unsupported DB_TYPE: ${config.dbType}.`;
  console.warn(message);
  return { success: false, message, dbType: config.dbType };
}


export async function isDatabaseEffectivelyConfigured(): Promise<boolean> {
  const config = getDbConfig();
  return config.dbType !== 'none' && config.dbType !== undefined;
}

