#!/usr/bin/env python3

import datetime
import logging
import urllib.request

import boto3
from botocore.exceptions import ClientError

logging.basicConfig()
_LOGGER = logging.getLogger('jmupark.lambda')
_LOGGER.setLevel(logging.DEBUG)

s3 = boto3.client('s3')

_TIME_FORMAT = '%Y-%m-%d-%H-%M-%S'
_DOWNLOAD_URL = 'https://www.jmu.edu/cgi-bin/parking_sign_data.cgi?hash=53616c7465645f5f2b3bed187af94815467e891744e87dc72a8d6f10cea4270a7fe8e2a08a3981a7a4bfb2ff402c4fdf8dc3cf0ae8b30a50f6ba85c7169b73b1edbafb488b046a19eb9588148d4e725f|869835tg89dhkdnbnsv5sg5wg0vmcf4mfcfc2qwm5968unmeh5'


def lambda_handler(event, context):
    start_time = datetime.datetime.now()
    key = f"{start_time.strftime(_TIME_FORMAT)}.xml"

    with urllib.request.urlopen(_DOWNLOAD_URL) as response:
        data = response.read()
    
    s3_response = s3.put_object(Bucket="jmu-parking-data", Key=key, Body=data)

    response = {
        'statusCode': s3_response['ResponseMetadata']['HTTPStatusCode'],
        'file': key,
        'body': data,
        'size': len(data),
    }
    _LOGGER.info("%s", response)
    return response


if __name__ == '__main__':
    lambda_handler(None, None)