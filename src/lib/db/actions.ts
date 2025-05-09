
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
    console.log("PostgreSQL: Table 'images' checked/created successfully.");
  } catch (err) {
    console.error("PostgreSQL: Error ensuring 'images' table exists:", err);
    throw err; // Re-throw the error to be caught by the calling function
  }
}


async function saveImageToPostgres(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  console.log(`Attempting to save image to Postgres (URL: ${config.postgresUrl}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  try {
    const { Client } = require('pg'); 
    const client = new Client({ connectionString: config.postgresUrl });
    await client.connect();
    try {
      await ensurePostgresTableInitialized(client); 

      const res = await client.query(
        'INSERT INTO images (data_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id::text, data_url, prompt, created_at',
        [image.dataUrl, image.prompt]
      );
      if (res.rows[0]) {
        console.log("Image saved to PostgreSQL successfully.");
        return { ...res.rows[0], createdAt: new Date(res.rows[0].created_at) } as GalleryImage;
      }
      console.error("PostgreSQL save error: No rows returned.");
      return null;
    } catch (dbError) {
      console.error("PostgreSQL save error:", dbError);
      return null;
    } finally {
      await client.end();
    }
  } catch (moduleError) {
     console.error("Error loading 'pg' module or connecting. Is 'pg' installed and POSTGRES_URL correct?", moduleError);
     console.warn("Falling back: Image not saved to PostgreSQL.");
     return null;
  }
}

async function getImagesFromPostgres(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from Postgres (URL: ${config.postgresUrl})`);
  try {
    const { Client } = require('pg'); 
    const client = new Client({ connectionString: config.postgresUrl });
    await client.connect();
    try {
      await ensurePostgresTableInitialized(client); 

      const res = await client.query('SELECT id::text, data_url, prompt, created_at FROM images ORDER BY created_at DESC');
      console.log(`Retrieved ${res.rows.length} images from PostgreSQL.`);
      return res.rows.map(row => ({...row, createdAt: new Date(row.created_at) })) as GalleryImage[];
    } catch (dbError) {
      console.error("PostgreSQL retrieval error:", dbError);
      return [];
    } finally {
      await client.end();
    }
  } catch (moduleError) {
    console.error("Error loading 'pg' module or connecting. Is 'pg' installed and POSTGRES_URL correct?", moduleError);
    console.warn("Falling back: Returning empty array from PostgreSQL.");
    return [];
  }
}

async function saveImageToMongo(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage | null> {
  console.log(`Attempting to save image to MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  try {
    const { MongoClient } = require('mongodb'); 
    const client = new MongoClient(config.mongodbUrl!);
    await client.connect();
    try {
      const db = client.db(config.mongodbDbName);
      
      // Explicitly try to create collection, ignore error if it already exists
      try {
        await db.createCollection('images');
        console.log("MongoDB 'images' collection created or ensured to exist.");
      } catch (e: any) {
        if (e.codeName === 'NamespaceExists') {
          console.log("MongoDB 'images' collection already exists.");
        } else {
          throw e; // Re-throw other errors related to createCollection
        }
      }
      
      const collection = db.collection('images');
      const docToInsert = { ...image, createdAt: new Date() };
      const result = await collection.insertOne(docToInsert);
      console.log("Image saved to MongoDB successfully.");
      return { ...docToInsert, id: result.insertedId.toString(), createdAt: docToInsert.createdAt };
    } catch (dbError) {
      console.error("MongoDB save error:", dbError);
      return null;
    } finally {
      await client.close();
    }
  } catch (moduleError) {
    console.error("Error loading 'mongodb' module or connecting. Is 'mongodb' installed and MongoDB env vars correct?", moduleError);
    console.warn("Falling back: Image not saved to MongoDB.");
    return null;
  }
}

async function getImagesFromMongo(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName})`);
  try {
    const { MongoClient } = require('mongodb'); 
    const client = new MongoClient(config.mongodbUrl!);
    await client.connect();
    try {
      const db = client.db(config.mongodbDbName);
      // For reads, if collection doesn't exist, find will return empty.
      // Explicit creation check isn't strictly necessary here but aligns with save if preferred.
      // However, typical MongoDB read patterns don't require pre-creation for `find`.
      const collection = db.collection('images');
      const imagesFromDb = await collection.find().sort({ createdAt: -1 }).toArray();
      console.log(`Retrieved ${imagesFromDb.length} images from MongoDB.`);
      return imagesFromDb.map(doc => ({
        id: doc._id.toString(), 
        dataUrl: doc.dataUrl,
        prompt: doc.prompt,
        createdAt: new Date(doc.createdAt), 
      })) as GalleryImage[];
    } catch (dbError) {
      console.error("MongoDB retrieval error:", dbError);
      return [];
    } finally {
      await client.close();
    }
  } catch (moduleError) {
    console.error("Error loading 'mongodb' module or connecting. Is 'mongodb' installed and MongoDB env vars correct?", moduleError);
    console.warn("Falling back: Returning empty array from MongoDB.");
    return [];
  }
}


export async function saveImageToDb(image: NewGalleryImage): Promise<GalleryImage | null> {
  const config = getDbConfig();
  try {
    if (config.dbType === 'postgres' && config.postgresUrl) {
      return await saveImageToPostgres(image, config);
    } else if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
      return await saveImageToMongo(image, config);
    } else {
      if (config.dbType !== 'none' && config.dbType !== undefined) { 
        console.log(`Database type ${config.dbType} configured but missing required URL/details. Image not saved to DB.`);
      }
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
    try {
      const { Client } = require('pg');
      const client = new Client({ connectionString: config.postgresUrl, connectionTimeoutMillis: 5000 });
      await client.connect();
      await ensurePostgresTableInitialized(client); 
      message = 'Successfully connected to PostgreSQL and ensured table "images" exists.';
      console.log(message);
      await client.end();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `Failed to connect to PostgreSQL or initialize table. Is 'pg' installed and POSTGRES_URL correct? Error: ${e.message}`;
      console.error(message, e);
      return { success: false, message, dbType: config.dbType };
    }
  } else if (config.dbType === 'mongodb') {
    if (!config.mongodbUrl || !config.mongodbDbName) {
      message = 'DB_TYPE is mongodb, but MONGODB_URL or MONGODB_DB_NAME is not set.';
      console.error(message);
      return { success: false, message, dbType: config.dbType };
    }
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(config.mongodbUrl!, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(config.mongodbDbName);
      await db.command({ ping: 1 }); 
      
      // Explicitly try to create collection, ignore error if it already exists
      try {
        await db.createCollection('images');
        message = `Successfully connected to MongoDB, database "${config.mongodbDbName}" pinged. Collection 'images' created or ensured to exist.`;
      } catch (e: any) {
        if (e.codeName === 'NamespaceExists') {
          message = `Successfully connected to MongoDB, database "${config.mongodbDbName}" pinged. Collection 'images' already exists.`;
        } else {
          throw e; // Re-throw other errors related to createCollection
        }
      }
      console.log(message);
      await client.close();
      return { success: true, message, dbType: config.dbType };
    } catch (e: any) {
      message = `Failed to connect to MongoDB or ensure collection exists. Is 'mongodb' installed and MONGODB env vars correct? Error: ${e.message}`;
      console.error(message, e);
      return { success: false, message, dbType: config.dbType };
    }
  }

  message = `Unsupported DB_TYPE: ${config.dbType}.`;
  console.warn(message);
  return { success: false, message, dbType: config.dbType };
}


export async function isDatabaseEffectivelyConfigured(): Promise<boolean> {
  const config = getDbConfig();
  if (!config.dbType || config.dbType === 'none' || config.dbType === undefined) {
    return false;
  }
  if (config.dbType === 'postgres' && config.postgresUrl) {
    return true;
  }
  if (config.dbType === 'mongodb' && config.mongodbUrl && config.mongodbDbName) {
    return true;
  }
  return false;
}
