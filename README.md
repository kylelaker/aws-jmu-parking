# aws-jmu-parking

The infrastructure I use to download the JMU parking data every minute on AWS using lambda and S3.
Prior to publishing, I had been using this for about a year. It was just configured manually. Then
Terraform was used. Now it is CDK. That results in some resource imports.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
