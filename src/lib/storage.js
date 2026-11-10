import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const mode = process.env.STORAGE_MODE || 'local';
const prefix = (process.env.S3_PREFIX || 'matchwear').replace(/^\/+|\/+$/g, '');
const localDir = path.resolve('data');

function client() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined
  });
}

export async function readJson(name, fallback = null) {
  try {
    if (mode === 's3') {
      const out = await client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `${prefix}/${name}` }));
      return JSON.parse(await out.Body.transformToString());
    }
    return JSON.parse(await readFile(path.join(localDir, name), 'utf8'));
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.code === 'ENOENT' || error.$metadata?.httpStatusCode === 404) return fallback;
    throw error;
  }
}

export async function writeJson(name, value, { publicRead = false } = {}) {
  const body = JSON.stringify(value, null, 2);
  if (mode === 's3') {
    const input = { Bucket: process.env.S3_BUCKET, Key: `${prefix}/${name}`, Body: body, ContentType: 'application/json', CacheControl: name === 'catalog.json' ? 'public, max-age=60' : 'no-store' };
    if (publicRead && process.env.S3_USE_ACL === 'true') input.ACL = 'public-read';
    await client().send(new PutObjectCommand(input));
  } else {
    await mkdir(localDir, { recursive: true });
    await writeFile(path.join(localDir, name), body);
  }
}
