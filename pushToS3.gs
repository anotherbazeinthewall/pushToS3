function onOpen() {
    DocumentApp.getUi().createMenu('Export PDF to S3')
        .addItem('Ship It!', 'exportPdfToS3')
        .addToUi();
}

function getAwsConfig() {
    return {
        region: 'BUCKET_REGION', // Your S3 bucket region
        bucketName: 'BUCKET_NAME', // Replace with your S3 bucket name
        accessKeyId: 'BUCKET_ACCESS_KEY', // Replace with your AWS Access Key ID
        secretAccessKey: 'BUCKET_SECRET_ACCESS_KEY' // Replace with your AWS Secret Access Key
    };
}

function exportPdfToS3() {
    var awsConfig = getAwsConfig();

    // Get the current active document
    var doc = DocumentApp.getActiveDocument();
    var docId = doc.getId();
    var docName = encodeURIComponent(doc.getName()) + '.pdf'; // URL encode the document name

    // Ensure OAuth token is refreshed and valid
    DriveApp.getRootFolder();

    // Export the Google Doc as a PDF
    var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + docId + '&exportFormat=pdf';
    var response = UrlFetchApp.fetch(url, {
        headers: {
            Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
        throw new Error('Failed to fetch PDF: ' + response.getContentText());
    }

    var pdfBlob = response.getBlob();
    var pdfBytes = pdfBlob.getBytes();

    // Prepare the request to upload to S3
    var host = awsConfig.bucketName + '.s3.' + awsConfig.region + '.amazonaws.com';
    var s3Url = 'https://' + host + '/' + docName;
    Logger.log('S3 URL: ' + s3Url);

    var now = new Date();
    var amzDate = Utilities.formatDate(now, 'GMT', "yyyyMMdd'T'HHmmss'Z'");
    var dateStamp = Utilities.formatDate(now, 'GMT', 'yyyyMMdd');
    var service = 's3';
    var algorithm = 'AWS4-HMAC-SHA256';

    // Compute the payload hash (required for all AWS4 requests)
    var payloadHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pdfBytes).map(function (e) { return ('0' + (e & 0xFF).toString(16)).slice(-2); }).join('');
    Logger.log('Payload Hash: ' + payloadHash);

    var credentialScope = dateStamp + '/' + awsConfig.region + '/' + service + '/aws4_request';
    var canonicalUri = '/' + docName;
    var canonicalQuerystring = '';
    var canonicalHeaders = 'host:' + host + '\n' + 'x-amz-content-sha256:' + payloadHash + '\n' + 'x-amz-date:' + amzDate + '\n';
    var signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    var canonicalRequest = 'PUT' + '\n' + canonicalUri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

    Logger.log('Canonical Request: ' + canonicalRequest);

    var stringToSign = algorithm + '\n' + amzDate + '\n' + credentialScope + '\n' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalRequest).map(function (e) { return ('0' + (e & 0xFF).toString(16)).slice(-2); }).join('');
    Logger.log('String to Sign: ' + stringToSign);

    var signingKey = getSignatureKey(awsConfig.secretAccessKey, dateStamp, awsConfig.region, service);
    var signature = Utilities.computeHmacSha256Signature(Utilities.newBlob(stringToSign).getBytes(), signingKey).map(function (e) { return ('0' + (e & 0xFF).toString(16)).slice(-2); }).join('');
    Logger.log('Signature: ' + signature);

    var authorizationHeader = algorithm + ' ' + 'Credential=' + awsConfig.accessKeyId + '/' + credentialScope + ', ' + 'SignedHeaders=' + signedHeaders + ', ' + 'Signature=' + signature;

    var headers = {
        Authorization: authorizationHeader,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash
    };

    Logger.log('Headers: ' + JSON.stringify(headers));

    // Upload the PDF to S3
    var options = {
        method: 'PUT',
        contentType: 'application/pdf',
        payload: pdfBytes,
        headers: headers,
        muteHttpExceptions: true
    };

    try {
        var uploadResponse = UrlFetchApp.fetch(s3Url, options);
        if (uploadResponse.getResponseCode() !== 200) {
            throw new Error('Failed to upload to S3: ' + uploadResponse.getContentText());
        }
        Logger.log('Upload successful: ' + uploadResponse.getContentText());
    } catch (e) {
        Logger.log('Upload failed: ' + e.message);
        throw e;
    }
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
    var kDate = hmacSha256('AWS4' + key, dateStamp);
    var kRegion = hmacSha256(kDate, regionName);
    var kService = hmacSha256(kRegion, serviceName);
    var kSigning = hmacSha256(kService, 'aws4_request');
    return kSigning;
}

function hmacSha256(key, data) {
    return Utilities.computeHmacSha256Signature(Utilities.newBlob(data).getBytes(), Utilities.newBlob(key).getBytes());
}
