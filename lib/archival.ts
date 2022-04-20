import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as batch from "@aws-cdk/aws-batch-alpha";
import * as python from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";

export interface ScriptSource {
  bucket: s3.IBucket;
  key: string;
}

export interface ArchivalTarget {
  bucket: s3.IBucket;
}

export interface ParkingDataArchivalProps {
  bucket: s3.IBucket;
  script: ScriptSource;
  archive: ArchivalTarget;
}

export class ParkingDataArchival extends Construct {
  constructor(scope: Construct, id: string, props: ParkingDataArchivalProps) {
    super(scope, id);
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { isDefault: true });

    const instance = new ec2.Instance(this, "Compute", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M6G,
        ec2.InstanceSize.XLARGE4
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(25, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      init: ec2.CloudFormationInit.fromConfigSets({
        configSets: {
          default: ["packageConfig", "fileSetup"],
        },
        configs: {
          packageConfig: new ec2.InitConfig([
            ec2.InitCommand.argvCommand(["yum", "update", "-y"]),
            ec2.InitPackage.yum("python3"),
            ec2.InitPackage.yum("python3-pip"),
            ec2.InitPackage.yum("python3-setuptools"),
            ec2.InitPackage.python("pip"),
            ec2.InitPackage.python("boto3"),
            ec2.InitPackage.python("click"),
          ]),
          fileSetup: new ec2.InitConfig([
            ec2.InitCommand.argvCommand(["mkdir", "-p", "/work"]),
            ec2.InitCommand.argvCommand([
              "mount",
              "-o",
              "mode=1777,nosuid,nodev",
              "-t",
              "tmpfs",
              "tmpfs",
              "/work",
            ]),
            ec2.InitFile.fromS3Object(
              "/opt/archive_annual.py",
              props.script.bucket,
              props.script.key
            ),
          ]),
          runArchive: new ec2.InitConfig([
            ec2.InitCommand.argvCommand(
              [
                "python3",
                "/opt/archive_annual.py",
                "--yes",
                "--data-bucket",
                props.bucket.bucketName,
                "--archive-bucket",
                props.archive.bucket.bucketName,
              ],
              {
                env: { WORKDIR_ROOT: "/work" },
              }
            ),
          ]),
        },
      }),
      initOptions: {
        configSets: ["default"],
        timeout: Duration.hours(6),
      },
    });
  }
}
