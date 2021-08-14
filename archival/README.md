# Parking Data Archival Tool

This is a tool to archive the data placed in AWS S3 by the downloader. This
gets run approximately annually to archive the data from the previous year
into a single .tar.xz file named for the year. The data is then stored in a
separate public S3 bucket.

## Running the Script

The script is intended to be run from an EC2 instance, ideally launched using
`template.yaml`. This EC2 instance will have the ability to make the necessary
changes in the specific S3 buckets for parking data and the archived data.

I use the following command to create the stack:

```
aws cloudformation create-stack --stack-name ArchiveInstance --template-body file://template.yaml --capabilities CAPABILITY_IAM
```

From there, the script can just be invoked on the instance but first become root and
run:

```
$ source env.sh
```

which will in turn setup some environment variables and activate the virtual
environment. Then execute the script with:

```
$ python3 archive-annual.py
```

You can optionally pass the `--threads` option to specify the number of concurrent
threads to use for downloads.


### Picking an Instance Type

The default instance type is an m6g.4xlarge which might be a little over powered
for this but it's nice to have plenty of extra cores for the downloads as well as when
it comes time to run `xz` to create the compressed archive file. The script seems
to work perfectly fine on x86_64 and arm64 instances.