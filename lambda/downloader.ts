import axios from 'axios';
import { format } from 'date-fns';
import { S3 } from '@aws-sdk/client-s3';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { ScheduledEvent, Context } from 'aws-lambda';

const tracer = new Tracer({ serviceName: 'jmuParkingDownloader' });
const logger = new Logger({ serviceName: 'jmuParkingDownloader' });
const s3 = tracer.captureAWSv3Client(new S3({ useFipsEndpoint: true }));

const BUCKET = process.env.BUCKET_NAME!;
const PARKING_URL = 'https://www.jmu.edu/cgi-bin/parking_sign_data.cgi';
const REQUIRED_URL_PARMS = {
  hash: '53616c7465645f5f2b3bed187af94815467e891744e87dc72a8d6f10cea4270a7fe8e2a08a3981a7a4bfb2ff402c4fdf8dc3cf0ae8b30a50f6ba85c7169b73b1edbafb488b046a19eb9588148d4e725f|869835tg89dhkdnbnsv5sg5wg0vmcf4mfcfc2qwm5968unmeh5',
};

// This is a separate function purely so that it can be tested
export function formatLexicographicTimestamp(date: Date): string {
  // format string should be equivalent to "%Y-%m-%d-%H-%M-%S"
  return format(date, 'yyyy-MM-dd-HH-mm-ss');
}

export async function handler(event: ScheduledEvent, context: Context): Promise<void> {
  logger.addContext(context);
  const startTime = new Date(event.time);
  const objectKey = `${formatLexicographicTimestamp(startTime)}.xml`;

  try {
    // Download data
    const response = await axios.get(PARKING_URL, { params: REQUIRED_URL_PARMS, transformResponse: (r) => r });
    const data: string = response.data;

    // Push to S3
    const s3Response = await s3.putObject({ Bucket: BUCKET, Key: objectKey, Body: data });
    logger.info('Data was successfully written to S3', {
      data: {
        statusCode: s3Response.$metadata.httpStatusCode,
        file: `s3://${BUCKET}/${objectKey}`,
        body: data,
        size: data.length,
      }
    });
  } catch (err) {
    logger.error('Error fetching or writing data', err as Error);
  }
}
