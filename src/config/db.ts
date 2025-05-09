
export interface DatabaseConfig {
  dbType?: 'postgres' | 'mongodb' | 'none';
  postgresUrl?: string;
  mongodbUrl?: string;
  mongodbDbName?: string;
}

export function getDbConfig(): DatabaseConfig {
  const dbType = process.env.DB_TYPE as 'postgres' | 'mongodb' | 'none' | undefined;

  if (!dbType || dbType === '' || dbType === 'none') {
    return { dbType: 'none' };
  }

  if (dbType === 'postgres') {
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      console.warn('DB_TYPE is postgres, but POSTGRES_URL is not set. Falling back to no database.');
      return { dbType: 'none' };
    }
    return { dbType: 'postgres', postgresUrl };
  }

  if (dbType === 'mongodb') {
    const mongodbUrl = process.env.MONGODB_URL;
    const mongodbDbName = process.env.MONGODB_DB_NAME;
    if (!mongodbUrl || !mongodbDbName) {
      console.warn('DB_TYPE is mongodb, but MONGODB_URL or MONGODB_DB_NAME is not set. Falling back to no database.');
      return { dbType: 'none' };
    }
    return { dbType: 'mongodb', mongodbUrl, mongodbDbName };
  }

  console.warn(`Unsupported DB_TYPE: ${dbType}. Falling back to no database.`);
  return { dbType: 'none' };
}
