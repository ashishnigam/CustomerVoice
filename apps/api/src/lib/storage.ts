import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
const region = process.env.S3_REGION || 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';
const bucket = process.env.S3_BUCKET || 'customervoice';

export const s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
    forcePathStyle: true, // required for MinIO
});

export async function uploadFileBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    prefix: string = 'attachments'
): Promise<string> {
    const ext = filename.split('.').pop();
    const key = `${prefix}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });

    await s3Client.send(command);

    // Return the public URL for the uploaded file
    // For local MinIO, it will be http://localhost:9000/customervoice/...
    // For AWS S3, you'd use the appropriate domain or cloudfront distribution
    const publicUrl = process.env.S3_PUBLIC_URL || `${endpoint}/${bucket}`;
    return `${publicUrl}/${key}`;
}
