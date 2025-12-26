import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contractId, title, content, userEmail } = await req.json();

    if (!contractId || !title || !content) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get Google Drive access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    if (!accessToken) {
      return Response.json({ 
        error: 'Google Drive not connected. Please connect your Google account first.' 
      }, { status: 400 });
    }

    // Create HTML file content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #4F8CFF; padding-bottom: 10px; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="metadata">
    <p><strong>Contract ID:</strong> ${contractId}</p>
    <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Created By:</strong> ${userEmail}</p>
  </div>
  <div class="content">
    ${content}
  </div>
</body>
</html>`;

    // Upload to Google Drive
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: `${title}.html`,
      mimeType: 'text/html',
      description: `Contract backup - ${contractId}`,
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/html\r\n\r\n' +
      htmlContent +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Google Drive API error:', error);
      return Response.json({ 
        error: 'Failed to save to Google Drive',
        details: error 
      }, { status: response.status });
    }

    const file = await response.json();

    // Log the backup
    await base44.asServiceRole.entities.ContractAuditLog.create({
      contract_id: contractId,
      action: 'contract_created',
      actor_email: userEmail,
      metadata_json: {
        google_drive_file_id: file.id,
        google_drive_file_name: file.name,
      },
    });

    return Response.json({
      success: true,
      message: 'Contract backed up to Google Drive',
      fileId: file.id,
      fileName: file.name,
      webViewLink: file.webViewLink,
    });

  } catch (error) {
    console.error('Error saving contract to Google Drive:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});