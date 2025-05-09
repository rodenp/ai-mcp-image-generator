'use server';

import { getDbConfig, type DatabaseConfig } from '@/config/db';
import type { GalleryImage, NewGalleryImage } from './types';

// Placeholder for actual PostgreSQL client and logic
async function saveImageToPostgres(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  console.log(`Attempting to save image to Postgres (URL: ${config.postgresUrl}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  console.warn('********************************************************************************************************');
  console.warn('* PostgreSQL saveImageToPostgres IS A PLACEHOLDER AND NOT FULLY IMPLEMENTED.                           *');
  console.warn('* No actual database save will occur. Returning null to allow localStorage fallback.                 *');
  console.warn('* USER IMPLEMENTATION NEEDED in src/lib/db/actions.ts.                                               *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to PostgreSQL using config.postgresUrl
  // 2. Execute INSERT query: e.g.,
  //    `INSERT INTO images (data_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id, data_url, prompt, created_at`
  // 3. Return the saved image object conforming to GalleryImage type. If error, throw or return null.
  // Example (requires 'pg' package and table 'images' with columns: id, data_url, prompt, created_at):
  /*
  const { Client } = require('pg'); // Make sure 'pg' is in package.json
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
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
  console.warn('* PostgreSQL getImagesFromPostgres IS A PLACEHOLDER AND NOT FULLY IMPLEMENTED.                         *');
  console.warn('* No actual database retrieval will occur. Returning empty array.                                      *');
  console.warn('* USER IMPLEMENTATION NEEDED in src/lib/db/actions.ts.                                               *');
  console.warn('********************************************************************************************************');
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to PostgreSQL using config.postgresUrl
  // 2. Execute SELECT query: e.g.,
  //    `SELECT id, data_url, prompt, created_at FROM images ORDER BY created_at DESC`
  // 3. Return an array of image objects conforming to GalleryImage type. If error, throw or return [].
  // Example:
  /*
  const { Client } = require('pg'); // Make sure 'pg' is in package.json
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
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
  // 1. Establish connection to MongoDB using config.mongodbUrl
  // 2. Select database (config.mongodbDbName) and collection (e.g., 'images')
  // 3. Insert the image document, including a createdAt field.
  // 4. Return the saved image object, mapping _id to id, conforming to GalleryImage type. If error, throw or return null.
  // Example (requires 'mongodb' package):
  /*
  const { MongoClient } = require('mongodb'); // Make sure 'mongodb' is in package.json
  const client = new MongoClient(config.mongodbUrl!);
  await client.connect();
  try {
    const db = client.db(config.mongodbDbName);
    const collection = db.collection('images');
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
  // 1. Establish connection to MongoDB using config.mongodbUrl
  // 2. Select database (config.mongodbDbName) and collection (e.g., 'images')
  // 3. Find documents, sort by createdAt descending.
  // 4. Map documents to GalleryImage type (convert _id to id string). If error, throw or return [].
  // Example:
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
      // This case means DB is 'none' or misconfigured for 'postgres'/'mongodb'
      // Returning null signals to the client that DB save didn't happen.
      if (config.dbType !== 'none') {
        console.log(`Database type ${config.dbType} configured but missing required URL/details. Image not saved to DB.`);
      } else {
         // console.log('Database not configured (DB_TYPE is "none"). Image not saved to DB.');
      }
      return null;
    }
  } catch (error) {
    console.error("Error in saveImageToDb dispatch:", error);
    return null; // Ensure null is returned on any unexpected error too
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
       if (config.dbType !== 'none') {
        console.log(`Database type ${config.dbType} configured but missing required URL/details. Cannot fetch images from DB.`);
      } else {
        // console.log('Database not configured (DB_TYPE is "none"). Cannot fetch images from DB.');
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
    return { success: true, message, dbType: config.dbType }; // Considered "success" as there's nothing to fail.
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
      message = 'Successfully connected to PostgreSQL.';
      console.log(message);
      await client.end();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `Failed to connect to PostgreSQL: ${e.message}`;
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    */
    message = 'PostgreSQL connection test is a PLACEHOLDER. USER IMPLEMENTATION NEEDED.';
    console.warn(message);
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
  // Returns true if dbType is 'postgres' or 'mongodb' AND their respective URLs are set.
  // getDbConfig() itself already handles falling back to 'none' if URLs are missing for a specified type.
  // So, we just need to check if the resulting dbType is not 'none'.
  return config.dbType !== 'none';
}
