provider "aws" {
  profile = var.profile
  region  = var.region
}

data "aws_partition" "current" {}

resource "aws_s3_bucket" "storage" {
  bucket = var.bucket_name
}

resource "aws_iam_role" "execution-role" {
  name               = "download-parking-role"
  description        = "Allow downloading data to S3"
  assume_role_policy = file("lambda-assume-role.json")
  tags = {
    Service = "Lambda"
  }
}

resource "aws_iam_role_policy" "policy" {
  name = "lambda-download-policy"
  role = aws_iam_role.execution-role.id

  policy = templatefile("s3-write.json", { bucket = var.bucket_name })
}

resource "aws_iam_role_policy_attachment" "execution-attach" {
  role       = aws_iam_role.execution-role.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "download-function" {
  filename      = "lambda_function_payload.zip"
  function_name = var.function_name
  role          = aws_iam_role.execution-role.arn
  handler       = "download.lambda_handler"

  source_code_hash = filebase64sha256("lambda_function_payload.zip")

  runtime = "python3.8"
  timeout = 5
}

resource "aws_cloudwatch_event_rule" "timer-event" {
  name        = "run-download-lambda"
  description = "Run download Lambda every minute"

  schedule_expression = "rate(1 minute)"
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.download-function.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.timer-event.arn
}

resource "aws_cloudwatch_event_target" "timer-target" {
  target_id = "run-lambda-every-minute"
  arn       = aws_lambda_function.download-function.arn
  rule      = aws_cloudwatch_event_rule.timer-event.name
}
