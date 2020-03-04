# aws-jmu-parking

The infrastructure I use to download the JMU parking data every minute on AWS using lambda and S3.
Prior to publishing, I had been using this for about a year. It was just configured manually
instead of with Terraform. Now it's finally infrastructure as code.

## Building

Use the following steps (probably not stable enough for a bash script) to build the infrastructure.
It is a goal to automate the creation of the `.zip` file.

```
cd function
pip install --target ./ requests
zip -r9 ../lambda_function_payload.zip .

cd ..
terraform plan
terraform apply
```
