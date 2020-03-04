import datetime

import boto3
import requests

_TIME_FORMAT = '%Y-%m-%d-%H-%M-%S'

def lambda_handler(event, context):
    start_time = datetime.datetime.now()
    data = requests.get("https://www.jmu.edu/cgi-bin/parking_get_sign_data.cgi").text
    s3_client = boto3.client('s3')
    key = f"{start_time.strftime(_TIME_FORMAT)}.xml"
    s3_response = s3_client.put_object(Bucket="jmu-parking-data", Key=key, Body=data)
    response = {
        'statusCode': s3_response['ResponseMetadata']['HTTPStatusCode'],
        'file': key,
        'body': data,
    }
    print(response)
    return response
