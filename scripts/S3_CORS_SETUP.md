# S3 CORS Configuration Setup

Your IAM user doesn't have permission to configure CORS programmatically. You need to configure it manually in the AWS Console.

## Steps to Configure CORS in AWS Console

1. **Go to AWS S3 Console**
   - Navigate to: https://s3.console.aws.amazon.com/s3/buckets/aicalltv?region=us-east-1

2. **Open Your Bucket**
   - Click on the bucket name: `aicalltv`

3. **Go to Permissions Tab**
   - Click on the **"Permissions"** tab at the top

4. **Scroll to Cross-origin resource sharing (CORS)**
   - Scroll down to find the **"Cross-origin resource sharing (CORS)"** section
   - Click **"Edit"**

5. **Paste the CORS Configuration**
   - Delete any existing configuration
   - Paste the following JSON:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://aicall.tv",
            "https://www.aicall.tv"
        ],
        "ExposeHeaders": [
            "Content-Length",
            "Content-Type",
            "ETag",
            "x-amz-request-id",
            "x-amz-version-id"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. **Save Changes**
   - Click **"Save changes"** at the bottom

7. **Verify**
   - After saving, the CORS configuration should be visible
   - Try downloading a video from your app - it should work now!

## Notes

- **AllowedOrigins**: Add your production domain(s) to the `AllowedOrigins` array
- **AllowedMethods**: Currently allows `GET` and `HEAD` (sufficient for downloading videos)
- **MaxAgeSeconds**: Browser will cache CORS preflight responses for 3000 seconds (50 minutes)

## Alternative: Update IAM Permissions

If you want to configure CORS programmatically in the future, you need to add the `s3:PutBucketCORS` permission to your IAM user policy.

