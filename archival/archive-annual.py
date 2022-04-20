#!/usr/bin/env python3

import os
import pathlib
import subprocess
import tempfile

from multiprocessing.pool import ThreadPool

import boto3
import click

from botocore.exceptions import ClientError


_CLIENT = boto3.client('s3')


def get_all_s3_objects(bucket_name, year):
    objects = []
    pages = 0
    paginator = _CLIENT.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket_name, Prefix=year):
        pages += 1
        page_objects = page.get('Contents', [])
        objects.extend([object['Key'] for object in page_objects])
    print(f"Took {pages} pages for {len(objects)} objects")
    return objects


def delete_objects(bucket, objects):
    """
    Delete a list of objects from S3 in parallel.

    If more than 1000 objects are given, then the list is broken up into chunks
    of 1000 objects and dispatched to up to some number of threads for deletion.
    This should make deletion happen faster and with fewer API calls.

    Objects with errors are printed to the console.

    :param bucket: The name of the S3 bucket to delete from
    :pram objects: The list of object keys to delete
    """
    def chunk_list(l):
        for i in range(0, len(l), 1000):
            yield [{'Key': val} for val in l[i:(i + 1000)]]

    def delete_chunked(chunk):
        try:
            result = _CLIENT.delete_objects(Bucket=bucket, Delete={'Objects': chunk})
            return result.get('Errors', [])
        except ClientError:
            return chunk

    # We need to convert this to a list because otherwise the magic to
    # automatically determine a chunk size for dispatching to the ThreadPool
    # will fail.
    object_chunks = list(chunk_list(objects))
    # Going any higher than two ends up causing issues with API request
    threads = min(2, len(object_chunks))
    with ThreadPool(processes=threads) as pool:
        results = pool.map(delete_chunked, object_chunks)
        failures = [failure for result_set in results for failure in result_set]
        return failures


@click.command()
@click.option(
    '--threads',
    '-t',
    type=click.INT,
    help="The number of threads to use for download",
    default=256,
)
@click.option(
    '--yes/--no',
    '-y/-n',
    help="Auto-accept prompts",
    default=False,
)
@click.option(
    "--data-bucket",
    type=click.STRING,
    required=True,
    help="The S3 bucket where the parking data archives are stored"
)
@click.option(
    "--archive-bucket",
    type=click.STRING,
    required=True,
    help="The S3 bucket where archive data is uploaded"
)
@click.option(
    "--year",
    "years",
    type=click.STRING,
    multiple=True,
    help="The year to process"
)
def main(threads, yes, data_bucket, archive_bucket, years):
    click.echo(f"Prepping data for: {','.join(years)}")
    data = {}
    for year in years:
        print(f"Listing objects for {year}")
        data[year] = get_all_s3_objects(data_bucket, year)
    print("Sorting complete")
    for year, objects in data.items():
        if not objects:
            print(f"Skipping {year} because there is no data")
            continue
        with tempfile.TemporaryDirectory(dir=os.getenv('WORKDIR_ROOT')) as temp_dir:
            print(f"Working on {year}")
            year_dir = pathlib.Path(temp_dir, year)
            print(f"Creating temp dir for {year}: {year_dir}")
            os.mkdir(year_dir)

            with click.progressbar(length=len(objects), label=f"Downloading {year}") as bar:
                def download_file(object_key):
                    # A separate client is required for each thread.
                    assert isinstance(object_key, str)
                    file_name = year_dir.joinpath(object_key)
                    _CLIENT.download_file(data_bucket, object_key, str(file_name))
                    bar.update(1)

                with ThreadPool(processes=threads) as pool:
                    pool.map(download_file, objects)

            print(f"Archiving {year}")
            # This is significantly faster than using shutil.make_archive
            subprocess.run(
                ["tar", "-cJf", f"{year}.tar.xz", "-C", temp_dir, year],
                env={"XZ_OPT": "-T0"}
            )
            print("Archive complete.")

            print(f"Uploading s3://{archive_bucket}/{year}.tar.xz")
            _CLIENT.upload_file(f"{year}.tar.xz", archive_bucket, f"{year}.tar.xz")
            waiter = _CLIENT.get_waiter('object_exists')
            waiter.wait(Bucket=archive_bucket, Key=f"{year}.tar.xz")
            print(f"Upload complete.")

        if yes or click.confirm(f"Delete objects for {year}"):
            print(f"Deleting all objects from {year}")
            failures = delete_objects(data_bucket, objects)
            print(f"Failed to delete: {failures}")
    
    return 0


if __name__ == '__main__':
    main()
