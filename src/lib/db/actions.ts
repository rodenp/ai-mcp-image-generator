
'use server';

import { getDbConfig, type DatabaseConfig } from '@/config/db';
import type { GalleryImage, NewGalleryImage } from './types';

// Placeholder for actual PostgreSQL client and logic
// e.g., import { Client } from 'pg';
async function saveImageToPostgres(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage> {
  console.log(`Attempting to save image to Postgres (URL: ${config.postgresUrl}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to PostgreSQL using config.postgresUrl
  // 2. Execute INSERT query: e.g.,
  //    `INSERT INTO images (data_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id, data_url, prompt, created_at`
  // 3. Return the saved image object conforming to GalleryImage type.
  // Example (requires 'pg' package and table 'images' with columns: id, data_url, prompt, created_at):
  /*
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
    const res = await client.query(
      'INSERT INTO images (data_url, prompt, created_at) VALUES ($1, $2, NOW()) RETURNING id::text, data_url, prompt, created_at',
      [image.dataUrl, image.prompt]
    );
    return res.rows[0] as GalleryImage;
  } finally {
    await client.end();
  }
  */
  // Placeholder return if not implemented:
  const newId = `pg-temp-${Date.now()}`;
  console.warn(`PostgreSQL saveImageToPostgres not fully implemented. Returning placeholder for ID: ${newId}`);
  return { ...image, id: newId, createdAt: new Date() };
}

async function getImagesFromPostgres(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from Postgres (URL: ${config.postgresUrl})`);
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to PostgreSQL using config.postgresUrl
  // 2. Execute SELECT query: e.g.,
  //    `SELECT id, data_url, prompt, created_at FROM images ORDER BY created_at DESC`
  // 3. Return an array of image objects conforming to GalleryImage type.
  // Example:
  /*
  const client = new Client({ connectionString: config.postgresUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT id::text, data_url, prompt, created_at FROM images ORDER BY created_at DESC');
    return res.rows as GalleryImage[];
  } finally {
    await client.end();
  }
  */
  // Placeholder return if not implemented:
  console.warn("PostgreSQL getImagesFromPostgres not fully implemented. Returning empty array.");
  return [];
}

// Placeholder for actual MongoDB client and logic
// e.g., import { MongoClient, ObjectId } from 'mongodb';
async function saveImageToMongo(image: NewGalleryImage, config: DatabaseConfig): Promise<GalleryImage> {
  console.log(`Attempting to save image to MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName}) - Prompt: ${image.prompt?.substring(0,30)}...`);
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to MongoDB using config.mongodbUrl
  // 2. Select database (config.mongodbDbName) and collection (e.g., 'images')
  // 3. Insert the image document, including a createdAt field.
  // 4. Return the saved image object, mapping _id to id, conforming to GalleryImage type.
  // Example (requires 'mongodb' package):
  /*
  const client = new MongoClient(config.mongodbUrl!);
  await client.connect();
  try {
    const db = client.db(config.mongodbDbName);
    const collection = db.collection('images');
    const docToInsert = { ...image, createdAt: new Date() };
    const result = await collection.insertOne(docToInsert);
    return { ...docToInsert, id: result.insertedId.toString() };
  } finally {
    await client.close();
  }
  */
  // Placeholder return if not implemented:
  const newId = `mongo-temp-${Date.now()}`;
  console.warn(`MongoDB saveImageToMongo not fully implemented. Returning placeholder for ID: ${newId}`);
  return { ...image, id: newId, createdAt: new Date() };
}

async function getImagesFromMongo(config: DatabaseConfig): Promise<GalleryImage[]> {
  console.log(`Attempting to get images from MongoDB (URL: ${config.mongodbUrl}, DB: ${config.mongodbDbName})`);
  // USER IMPLEMENTATION NEEDED:
  // 1. Establish connection to MongoDB using config.mongodbUrl
  // 2. Select database (config.mongodbDbName) and collection (e.g., 'images')
  // 3. Find documents, sort by createdAt descending.
  // 4. Map documents to GalleryImage type (convert _id to id string).
  // Example:
  /*
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
      createdAt: doc.createdAt,
    })) as GalleryImage[];
  } finally {
    await client.close();
  }
  */
  // Placeholder return if not implemented:
  console.warn("MongoDB getImagesFromMongo not fully implemented. Returning empty array.");
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
      console.log('Database not configured or DB_TYPE is "none". Image not saved to DB.');
      return null;
    }
  } catch (error) {
    console.error("Error saving image to DB:", error);
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
      console.log('Database not configured or DB_TYPE is "none". Cannot fetch images from DB.');
      return [];
    }
  } catch (error) {
    console.error("Error fetching images from DB:", error);
    return [];
  }
}
