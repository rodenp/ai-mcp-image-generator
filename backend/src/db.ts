import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Expects .env in project root

const dbType = process.env.DB_TYPE;

if (!dbType) {
  throw new Error('DB_TYPE is not defined in .env');
}

let postgresPool: Pool | null = null;
let mongoClient: MongoClient | null = null;

if (dbType === 'postgres') {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error('POSTGRES_URL must be defined in .env when DB_TYPE=postgres');
  }

  postgresPool = new Pool({ connectionString: postgresUrl });
  console.log('[DB] Initialized PostgreSQL pool');
}

if (dbType === 'mongodb') {
  const mongodbUrl = process.env.MONGODB_URL;
  if (!mongodbUrl) {
    throw new Error('MONGODB_URL must be defined in .env when DB_TYPE=mongodb');
  }

  mongoClient = new MongoClient(mongodbUrl);
  console.log('[DB] Initialized MongoDB client');
}

export const db = {
  type: dbType,
  postgresPool,
  mongoClient,
};