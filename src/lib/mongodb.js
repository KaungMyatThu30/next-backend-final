import { MongoClient } from "mongodb";

const options = {};
let globalClientPromise = globalThis.__mongoClientPromise;
let hasLoggedMongoConnection = globalThis.__mongoHasLoggedConnection || false;

function createClientPromise(uri) {
  const client = new MongoClient(uri, options);
  return client.connect().then((connectedClient) => {
    if (!hasLoggedMongoConnection) {
      console.log("[mongodb] Connected");
      hasLoggedMongoConnection = true;
      globalThis.__mongoHasLoggedConnection = true;
    }
    return connectedClient;
  });
}

export function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please add your Mongo URI to .env.local or set MONGODB_URI env variable"
    );
  }
  if (!globalClientPromise) {
    globalClientPromise = createClientPromise(uri);
    globalThis.__mongoClientPromise = globalClientPromise;
  }
  return globalClientPromise;
}

if (process.env.MONGODB_EAGER_CONNECT !== "false") {
  try {
    void getClientPromise();
  } catch (error) {
    console.error("[mongodb] Initial connection failed:", error);
  }
}
