# pushToS3

A simple Google Docs AppScript that exports to current doc as a PDF and pushes it to an S3 bucket that you own.

## Manual Installation

1. Open the GAS project for your Google Doc via Extensions -> AppScript.
2. Create a new Script called pushToS3 (or whatever you want).
3. Replace BUCKET_REGION, BUCKET_NAME, BUCKET_ACCESS_KEY, and BUCKET_SECRET_ACCESS_KEY with their respective credentials.
4. Reload your doc to show the "Export PDF to S3" dropdown menu.
5. Select the "Ship It!" button and authorize the script. 
6. 

## Considerations

**Do not hard code sensitive credentials (ie - for a role that has permissions to do anything other than upload this file) into the script**
