import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs"
import { Construct } from 'constructs';

export interface JmuParkingStackProps extends StackProps {
  bucketName?: string;
  alarmEmailAddress?: string;
}

export class JmuParkingStack extends Stack {
  constructor(scope: Construct, id: string, props: JmuParkingStackProps) {
    super(scope, id, props);

    const bucket = this.getOrMakeBucket(props?.bucketName);

    const fn = new nodejs.NodejsFunction(this, "Downloader", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "lambda/downloader.ts",
      description: "Downloads parking availability to an S3 bucket",
      memorySize: 256,
      timeout: Duration.seconds(10),
      tracing: lambda.Tracing.ACTIVE,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        BUCKET_NAME: bucket.bucketName
      }
    });
    bucket.grantWrite(fn);

    const frequency = Duration.minutes(1)
    const rule = new events.Rule(this, "TimerEvent", {
      description: `Trigger download every ${frequency.toHumanString()}`,
      schedule: events.Schedule.rate(frequency),
      targets: [new targets.LambdaFunction(fn)],
    });

    const alarm = new cw.Alarm(this, "Errors", {
      metric: fn.metricErrors({ period: frequency }),
      threshold: 1,
      evaluationPeriods: 60,
      datapointsToAlarm: 10,
    });

    if (props.alarmEmailAddress) {
      const failureNotifyTopic = new sns.Topic(this, "Notifications");
      alarm.addAlarmAction(new actions.SnsAction(failureNotifyTopic));
      failureNotifyTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alarmEmailAddress)
      );
    }
  }

  private getOrMakeBucket(bucketName?: string): s3.IBucket {
    if (bucketName) {
      return s3.Bucket.fromBucketName(this, "Bucket", bucketName);
    }
    return new s3.Bucket(this, "Bucket", {
      // Ensure that objects remain accessible after the bucket is deleted
      // and prevent issues with overwrites
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: true,
      // Require objects to be encrypted when put in the bucket
      encryption: s3.BucketEncryption.KMS_MANAGED,
      // Ensure the bucket is private
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });
  }
}
