import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from 'constructs';

export interface JmuParkingStackProps extends StackProps {
  bucketName: string;
  alarmEmailAddress?: string;
}

export class JmuParkingStack extends Stack {
  constructor(scope: Construct, id: string, props: JmuParkingStackProps) {
    super(scope, id, props);

    const bucket = s3.Bucket.fromBucketName(this, "Bucket", props.bucketName);

    const fn = new lambda.Function(this, "Downloader", {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: "downloader.lambda_handler",
      code: lambda.Code.fromAsset("lambda"),
      memorySize: 256,
      timeout: Duration.seconds(10),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    bucket.grantWrite(fn);

    const rule = new events.Rule(this, "TimerEvent", {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [new targets.LambdaFunction(fn)],
    });

    const alarm = new cw.Alarm(this, "Errors", {
      metric: fn.metricErrors({ period: Duration.minutes(1) }),
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
}
