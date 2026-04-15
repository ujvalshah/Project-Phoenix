import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/nuggets_vitest_bookmarks';

export async function tryConnectIntegrationMongo(): Promise<boolean> {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    return true;
  } catch {
    return false;
  }
}

export async function disconnectIntegrationMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}
