import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export function makeS3() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET || "screenshots";
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("Missing S3 env vars");

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });
  return { client, bucket };
}

export async function putPng({ client, bucket, key, buffer }) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/png"
  }));
}
