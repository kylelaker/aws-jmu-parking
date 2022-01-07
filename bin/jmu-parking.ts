#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JmuParkingStack } from '../lib/jmu-parking-stack';

const app = new cdk.App();
new JmuParkingStack(app, 'JmuParkingStack', {
  bucketName: "jmu-parking-data",
  alarmEmailAddress: "aws-alarms@kylelaker.com"
});