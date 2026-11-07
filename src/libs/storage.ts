import { S3Client } from "@aws-sdk/client-s3";
import { neonEnv } from "../config/env.js";

// Must match the bucket declared under `buckets` in neon.ts.
export const ASSETS_BUCKET = "assets";

// Neon Object Storage is S3-compatible, so we use the standard AWS SDK.
// Credentials are scoped to the Neon branch (see NEON_BRANCH in .env).
export const s3 = new S3Client({
  endpoint: neonEnv.storage.endpoint,
  region: neonEnv.storage.region,
  credentials: {
    accessKeyId: neonEnv.storage.accessKeyId,
    secretAccessKey: neonEnv.storage.secretAccessKey,
  },
  forcePathStyle: true, // required: Neon only supports path-style addressing
});
