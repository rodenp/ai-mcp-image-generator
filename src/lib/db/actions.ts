
'use server';

import { getDbConfig, type DatabaseConfig } from '@/config/db';
import type { GalleryImage, NewGalleryImage } from './types';

// Helper function for PostgreSQL to ensure table exists
async function ensurePostgresTableInitialized(client: any): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      storage_url TEXT NOT NULL, -- Changed from data_url to storage_url
      prompt TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  try {
    await client.query(createTableQuery);
    console.log("[ensurePostgresTableInitialized] PostgreSQL: Table 'images' checked/created successfully.");
  } catch (err) {
    console.error("[ensurePostgresTableInitialized] PostgreSQL: Error ensuring 'images' table exists:", err);
    throw err; 
  }
}


async function saveImageToPostgres(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  const imagePromptSnippet = image.prompt?.substring(0,30) || 'N/A';
  // Note: image.dataUrl now contains the storage URL
  console.log(`[saveImageToPostgres] Attempting to save image to Postgres (URL: ${config.postgresUrl}) - Prompt: ${imagePromptSnippet}, Storage URL: ${image.dataUrl.substring(0, 50)}...`);
  try {
    const { Client } = require('pg'); 
    const client = new Client({ connectionString: config.postgresUrl });
    await client.connect();
    try {
      await ensurePostgresTableInitialized(client); 

      const res = await client.query(
        'INSERT INTO images (storage_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id::text, storage_url AS "dataUrl", prompt, created_at', // Alias storage_url to dataUrl for consistency
        [image.dataUrl, image.prompt] // image.dataUrl is now the storage URL
      );
      if (res.rows[0]) {
        console.log(`[saveImageToPostgres] Image with prompt snippet "${imagePromptSnippet}" saved to PostgreSQL successfully.`);
        return { ...res.rows[0], createdAt: new Date(res.rows[0].created_at) } as GalleryImage;
      }
      console.error(`[saveImageToPostgres] PostgreSQL save error for prompt snippet "${imagePromptSnippet}": No rows returned from INSERT ... RETURNING.`);
      return null;
    } catch (dbError: any) {
      console.error(`[saveImageToPostgres] PostgreSQL DB operation error for prompt snippet "${imagePromptSnippet}":`, dbError.message, dbError);
      return null;
    } finally {
      await client.end();
    }
  } catch (moduleError: any) {
     console.error(`[saveImageToPostgres] Error loading 'pg' module or connecting for prompt snippet "${imagePromptSnippet}". Is 'pg' installed and POSTGRES_URL correct? Error:`, moduleError.message, moduleError);
     console.warn(`[saveImageToPostgres] Falling back: Image with prompt snippet "${imagePromptSnippet}" not saved to PostgreSQL.`);
     return null;
  }
}

async function getImagesFromPostgres(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`[getImagesFromPostgres] Attempting to get images from Postgres (URL: ${config.postgresUrl})`);
  try {
    const { Client } = require('pg'); 
    const client = new Client({ connectionString: config.postgresUrl });
    await client.connect();
    try {
      await ensurePostgresTableInitialized(client); 

      const res = await client.query('SELECT id::text, storage_url AS "dataUrl", prompt, created_at FROM images ORDER BY created_at DESC'); // Alias storage_url
      console.log(`[getImagesFromPostgres] Retrieved ${res.rows.length} images from PostgreSQL.`);
      return res.rows.map(row => ({...row, createdAt: new Date(row.created_at) })) as GalleryImage[];
    } catch (dbError: any) {
      console.error("[getImagesFromPostgres] PostgreSQL DB retrieval error:", dbError.message, dbError);
      return [];
    } finally {
      await client.end();
    }
  } catch (moduleError: any) {
    console.error("[getImagesFromPostgres] Error loading 'pg' module or connecting. Is 'pg' installed and POSTGRES_URL correct? Error:", moduleError.message, moduleError);
    console.warn("[getImagesFromPostgres] Falling back: Returning empty array from PostgreSQL.");
    return [];
  }
}

async function ensureMongoCollectionInitialized(db: any): Promise<void> {
  try {
    // Check if collection exists by trying to get its info, or create it
    const collections = await db.listCollections({ name: 'images' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('images');
      console.log("[ensureMongoCollectionInitialized] MongoDB 'images' collection created.");
    } else {
      console.log("[ensureMongoCollectionInitialized] MongoDB 'images' collection already exists.");
    }
    // Optionally, create indexes if needed
    // await db.collection('images').createIndex({ createdAt: -1 });
  } catch (e: any) {
    console.error("[ensureMongoCollectionInitialized] Error ensuring MongoDB collection 'images' exists:", e.message, e);
    throw e;
  }
}


async function saveImageToMongo(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  const imagePromptSnippet = image.prompt?.substring(0,30) || 'N/A';
  // Note: image.dataUrl now contains the storage URL
  console.log(`[saveImageToMongo] Attempting to save image to MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName}) - Prompt: ${imagePromptSnippet}, Storage URL: ${image.dataUrl.substring(0,50)}...`);
  try {
    const { MongoClient } = require('mongodb'); 
    const client = new MongoClient(config.mongodbUrl!);
    await client.connect();
    try {
      const db = client.db(config.mongodbDbName);
      await ensureMongoCollectionInitialized(db);
      
      const collection = db.collection('images');
      // Store storage_url instead of data_url
      const docToInsert = { storage_url: image.dataUrl, prompt: image.prompt, createdAt: new Date() };
      const result = await collection.insertOne(docToInsert);
      console.log(`[saveImageToMongo] Image with prompt snippet "${imagePromptSnippet}" saved to MongoDB successfully.`);
      // Return with dataUrl field for consistency with GalleryImage type
      return { id: result.insertedId.toString(), dataUrl: docToInsert.storage_url, prompt: docToInsert.prompt, createdAt: docToInsert.createdAt };
    } catch (dbError: any) {
      console.error(`[saveImageToMongo] MongoDB DB operation error for prompt snippet "${imagePromptSnippet}":`, dbError.message, dbError);
      return null;
    } finally {
      await client.close();
    }
  } catch (moduleError: any) {
    console.error(`[saveImageToMongo] Error loading 'mongodb' module or connecting for prompt snippet "${imagePromptSnippet}". Is 'mongodb' installed and MongoDB env vars correct? Error:`, moduleError.message, moduleError);
    console.warn(`[saveImageToMongo] Falling back: Image with prompt snippet "${imagePromptSnippet}" not saved to MongoDB.`);
    return null;
  }
}

async function getImagesFromMongo(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`[getImagesFromMongo] Attempting to get images from MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName})`);
  try {
    const { MongoClient } = require('mongodb'); 
    const client = new MongoClient(config.mongodbUrl!);
    await client.connect();
    try {
      const db = client.db(config.mongodbDbName);
      await ensureMongoCollectionInitialized(db);
      const collection = db.collection('images');
      
      const imagesFromDb = await collection.find().sort({ createdAt: -1 }).toArray();
      console.log(`[getImagesFromMongo] Retrieved ${imagesFromDb.length} images from MongoDB.`);
      return imagesFromDb.map((doc: any) => ({ // Add type for doc
        id: doc._id.toString(), 
        dataUrl: doc.storage_url, // Retrieve storage_url and map to dataUrl
        prompt: doc.prompt,
        createdAt: new Date(doc.createdAt), 
      })) as GalleryImage[];
    } catch (dbError: any) {
      console.error("[getImagesFromMongo] MongoDB DB retrieval error:", dbError.message, dbError);
      return [];
    } finally {
      await client.close();
    }
  } catch (moduleError: any) {
    console.error("[getImagesFromMongo] Error loading 'mongodb' module or connecting. Is 'mongodb' installed and MongoDB env vars correct? Error:", moduleError.message, moduleError);
    console.warn("[getImagesFromMongo] Falling back: Returning empty array from MongoDB.");
    return [];
  }
}


export async function saveImageToDb(image: NewGalleryImage): Promise<GalleryImage | null> {
  const config = getDbConfig();
  // image.dataUrl is expected to be the storage URL if DB is used
  try {
    if (config.dbType === 'postgres' && config.postgresUrl) {
      return await saveImageToPostgres(image, config);
    } else if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
      return await saveImageToMongo(image, config);
    } else {
      if (config.dbType !== 'none' && config.dbType !== undefined) { 
        console.warn(`[saveImageToDb] Attempted to save image, but DB_TYPE "${config.dbType}" is configured without all necessary environment variables (e.g., URL, DB_NAME). Image not saved to DB. Please check server logs and .env configuration.`);
      } else if (config.dbType === 'none' || config.dbType === undefined) {
        console.log("[saveImageToDb] DB_TYPE is 'none' or not set. Image not saved to DB (this is expected if not using a database).");
      }
      return null;
    }
  } catch (error: any) {
    console.error("[saveImageToDb] Unexpected error during dispatch or unhandled exception from DB function:", error.message, error);
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
        console.warn(`[getImagesFromDb] Attempted to get images, but DB_TYPE "${config.dbType}" is configured without all necessary environment variables. Cannot fetch images from DB.`);
      } else if (config.dbType === 'none' || config.dbType === undefined) {
        console.log("[getImagesFromDb] DB_TYPE is 'none' or not set. Not fetching images from DB.");
      }
      return [];
    }
  } catch (error: any) {
    console.error("[getImagesFromDb] Unexpected error during dispatch or unhandled exception from DB function:", error.message, error);
    return [];
  }
}

export async function testDbConnection(): Promise<{success: boolean; message: string; dbType: string | undefined}> {
  const config = getDbConfig();
  let message = '';

  console.log(`[testDbConnection] Attempting to test DB connection for DB_TYPE: ${config.dbType}`);

  if (!config.dbType || config.dbType === 'none') {
    message = '[testDbConnection] DB_TYPE is "none" or not set. No database connection to test.';
    console.log(message);
    return { success: true, message, dbType: config.dbType };
  }

  if (config.dbType === 'postgres') {
    if (!config.postgresUrl) {
      message = '[testDbConnection] DB_TYPE is postgres, but POSTGRES_URL is not set.';
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    try {
      const { Client } = require('pg');
      const client = new Client({ connectionString: config.postgresUrl, connectionTimeoutMillis: 5000 });
      await client.connect();
      console.log("[testDbConnection] Successfully connected to PostgreSQL instance.");
      await ensurePostgresTableInitialized(client); 
      message = '[testDbConnection] Successfully connected to PostgreSQL and ensured table "images" exists.';
      console.log(message);
      await client.end();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `[testDbConnection] Failed to connect to PostgreSQL or initialize table. Is 'pg' installed and POSTGRES_URL correct? Error: ${e.message}`;
      console.error(message, e);
      return { success: false, message, dbType: config.dbType };
    }
  } else if (config.dbType === 'mongodb') {
    if (!config.mongodbUrl || !config.mongodbDbName) {
      message = '[testDbConnection] DB_TYPE is mongodb, but MONGODB_URL or MONGODB_DB_NAME is not set.';
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(config.mongodbUrl!, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      console.log("[testDbConnection] Successfully connected to MongoDB instance.");
      const db = client.db(config.mongodbDbName);
      await db.command({ ping: 1 }); 
      console.log(`[testDbConnection] Successfully pinged MongoDB database "${config.mongodbDbName}".`);
      
      await ensureMongoCollectionInitialized(db);
      message = `[testDbConnection] Successfully connected to MongoDB, database "${config.mongodbDbName}" pinged. Collection 'images' ensured to exist.`;
      
      console.log(message);
      await client.close();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `[testDbConnection] Failed to connect to MongoDB, ping, or ensure collection exists. Is 'mongodb' installed and MONGODB env vars correct? Error: ${e.message}`;
      console.error(message, e);
      return { success: false, message, dbType: config.dbType };
    }
  }

  message = `[testDbConnection] Unsupported DB_TYPE: ${config.dbType}.`;
  console.warn(message);
  return { success: false, message, dbType: config.dbType };
}


export async function isDatabaseEffectivelyConfigured(): Promise<boolean> {
  const config = getDbConfig(); 
  if (!config.dbType || config.dbType === 'none' || config.dbType === undefined) {
    console.log("[isDatabaseEffectivelyConfigured] Result: false (DB_TYPE is none or undefined)");
    return false;
  }
  if (config.dbType === 'postgres' && config.postgresUrl) {
    console.log("[isDatabaseEffectivelyConfigured] Result: true (PostgreSQL with URL)");
    return true;
  }
  if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
    console.log("[isDatabaseEffectivelyConfigured] Result: true (MongoDB with URL and DB Name)");
    return true;
  }
  
  console.log(`[isDatabaseEffectivelyConfigured] Result: false (DB_TYPE "${config.dbType}" set, but required env vars like URL/DB_NAME are missing)`);
  return false;
}
