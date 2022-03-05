#!/usr/bin/env python3

import datetime
import json
import logging
import os
import traceback

import boto3
import requests
from botocore.exceptions import ClientError
from requests.exceptions import RequestException

from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all as xray_patch_all


logging.basicConfig()
_LOGGER = logging.getLogger("jmupark.lambda")
_LOGGER.setLevel(logging.DEBUG)

xray_patch_all()
s3 = boto3.client("s3")

_TIME_FORMAT = "%Y-%m-%d-%H-%M-%S"
_DOWNLOAD_URL = "https://www.jmu.edu/cgi-bin/parking_sign_data.cgi"
_URL_PARAMS = {
    "hash": "53616c7465645f5f2b3bed187af94815467e891744e87dc72a8d6f10cea4270a7fe8e2a08a3981a7a4bfb2ff402c4fdf8dc3cf0ae8b30a50f6ba85c7169b73b1edbafb488b046a19eb9588148d4e725f|869835tg89dhkdnbnsv5sg5wg0vmcf4mfcfc2qwm5968unmeh5"
}

BUCKET_NAME = os.getenv("BUCKET_NAME")


def lambda_handler(event, context):
    start_time = datetime.datetime.now()
    key = f"{start_time.strftime(_TIME_FORMAT)}.xml"

    try:
        data = requests.get(_DOWNLOAD_URL, params=_URL_PARAMS, timeout=7).content
        s3_response = s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=data)

        response = {
            "statusCode": s3_response["ResponseMetadata"]["HTTPStatusCode"],
            "file": f"s3://{BUCKET_NAME}/{key}",
            "body": data,
            "size": len(data),
        }
    except (ClientError, RequestException, TypeError) as err:
        response = {
            "statusCode": 500,
            "error": str(err),
            "trace": "".join(traceback.format_exception(err))
        }

    _LOGGER.info("%s", json.dumps(response, default=str))
    return response


if __name__ == "__main__":
    lambda_handler(None, None)
