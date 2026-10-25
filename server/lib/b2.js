const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const B2_KEY_ID = process.env.B2_KEY_ID || '88f1fd41da2e';
const B2_APP_KEY = process.env.B2_APPLICATION_KEY || '005b74a0d3236052489fc46b0f5b176794c544f3d1';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || '38f8bf119f8d7421ad1a021e';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'aaroh-papers';

let cachedAuth = null;
let authExpiresAt = 0;

function isB2Configured() {
  return !!(B2_KEY_ID && B2_APP_KEY && (B2_BUCKET_ID || B2_BUCKET_NAME));
}

async function authorize() {
  if (cachedAuth && Date.now() < authExpiresAt) {
    return cachedAuth;
  }

  const basic = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${basic}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`B2 Authorization failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedAuth = {
    token: data.authorizationToken,
    apiUrl: data.apiInfo.storageApi.apiUrl,
    downloadUrl: data.apiInfo.storageApi.downloadUrl,
    accountId: data.accountId
  };
  // Cache for 20 hours (tokens are valid for 24 hours)
  authExpiresAt = Date.now() + 20 * 60 * 60 * 1000;
  return cachedAuth;
}

async function getUploadUrl() {
  const auth = await authorize();
  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get B2 upload URL (${res.status}): ${errText}`);
  }

  return res.json();
}

async function uploadFile(remoteFileName, bufferOrString, contentType = 'text/csv') {
  if (!isB2Configured()) return null;
  const buffer = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString, 'utf8');
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

  const { uploadUrl, authorizationToken } = await getUploadUrl();
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(remoteFileName),
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'X-Bz-Content-Sha1': sha1
    },
    body: buffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`B2 file upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  console.log(`[Backblaze B2] Successfully uploaded ${remoteFileName} (${buffer.length} bytes)`);
  return data;
}

async function listFiles(prefix = '') {
  if (!isB2Configured()) return [];
  const auth = await authorize();
  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
    method: 'POST',
    headers: {
      Authorization: auth.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      prefix,
      maxFileCount: 1000
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`B2 list files failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

async function downloadFile(remoteFileName) {
  if (!isB2Configured()) return null;
  const auth = await authorize();
  const url = `${auth.downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURI(remoteFileName)}`;
  const res = await fetch(url, {
    headers: { Authorization: auth.token }
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const errText = await res.text();
    throw new Error(`B2 download failed (${res.status}): ${errText}`);
  }

  return res.text();
}

async function downloadBuffer(remoteFileName) {
  if (!isB2Configured()) return null;
  const auth = await authorize();
  const url = `${auth.downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURI(remoteFileName)}`;
  const res = await fetch(url, {
    headers: { Authorization: auth.token }
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const errText = await res.text();
    throw new Error(`B2 download failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getFileInfo(remoteFileName) {
  if (!isB2Configured()) return null;
  try {
    const files = await listFiles(remoteFileName);
    return files.find((f) => f.fileName === remoteFileName) || null;
  } catch {
    return null;
  }
}

// Uploads all local CSV papers from test/ to Backblaze B2
async function syncLocalPapersToB2(testDir) {
  if (!isB2Configured()) return { uploaded: 0 };
  const targetDir = testDir || process.env.TEST_DIR || path.join(__dirname, '../../test');
  if (!fs.existsSync(targetDir)) return { uploaded: 0 };

  const { findCsvFiles } = require('./importPack');
  const files = findCsvFiles(targetDir);
  console.log(`[Backblaze B2] Syncing ${files.length} local papers to B2 bucket '${B2_BUCKET_NAME}'...`);

  let count = 0;
  for (const f of files) {
    try {
      const rel = path.relative(targetDir, f).replace(/\\/g, '/');
      const content = fs.readFileSync(f);
      await uploadFile(`papers/${rel}`, content, 'text/csv');
      count++;
    } catch (err) {
      console.warn(`[Backblaze B2] Could not upload ${f}:`, err.message);
    }
  }

  return { uploaded: count, total: files.length };
}

// On server boot, restores any papers from Backblaze B2 into the local test directory
async function restorePapersFromB2(testDir) {
  if (!isB2Configured()) return { restored: 0 };
  const targetDir = testDir || process.env.TEST_DIR || path.join(__dirname, '../../test');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  console.log(`[Backblaze B2] Checking bucket '${B2_BUCKET_NAME}' for cloud papers...`);
  try {
    const remoteFiles = await listFiles('papers/');
    let restored = 0;

    for (const rf of remoteFiles) {
      try {
        const rel = rf.fileName.replace(/^papers\//, '');
        if (!rel.endsWith('.csv')) continue;
        const localPath = path.join(targetDir, rel);
        fs.mkdirSync(path.dirname(localPath), { recursive: true });

        const content = await downloadFile(rf.fileName);
        if (content) {
          fs.writeFileSync(localPath, content, 'utf8');
          restored++;
        }
      } catch (e) {
        console.warn(`[Backblaze B2] Failed restoring ${rf.fileName}:`, e.message);
      }
    }

    console.log(`[Backblaze B2] Restored ${restored} paper(s) from cloud storage.`);
    return { restored, total: remoteFiles.length };
  } catch (err) {
    console.warn(`[Backblaze B2] Cloud restore skipped:`, err.message);
    return { restored: 0, error: err.message };
  }
}

// Upload a single paper CSV directly to Backblaze B2
async function uploadPaperCsv(subFolder, fileName, csvContent) {
  if (!isB2Configured()) return null;
  const safeName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const remotePath = `papers/${subFolder}/${safeName}`;
  return uploadFile(remotePath, csvContent, 'text/csv');
}

async function deleteFileVersion(fileId, fileName) {
  if (!isB2Configured()) return null;
  const auth = await authorize();
  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: 'POST',
    headers: {
      Authorization: auth.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileId, fileName })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete file version (${res.status}): ${errText}`);
  }
  return res.json();
}

async function pruneOldFileVersions(remoteFileName, keepCount = 1) {
  if (!isB2Configured()) return { deleted: 0 };
  const auth = await authorize();
  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_versions`, {
    method: 'POST',
    headers: {
      Authorization: auth.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      prefix: remoteFileName,
      maxFileCount: 1000
    })
  });

  if (!res.ok) return { deleted: 0 };
  const data = await res.json();
  const versions = (data.files || []).filter((f) => f.fileName === remoteFileName);
  // Sort descending by uploadTimestamp (newest first)
  versions.sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);

  let deleted = 0;
  for (let i = keepCount; i < versions.length; i++) {
    try {
      await deleteFileVersion(versions[i].fileId, versions[i].fileName);
      deleted++;
    } catch (e) {
      console.warn(`[Backblaze B2] Failed deleting old version ${versions[i].fileId}:`, e.message);
    }
  }
  if (deleted > 0) {
    console.log(`[Backblaze B2] Cleaned up ${deleted} previous backup version(s) for ${remoteFileName}. Keeping latest ${keepCount}.`);
  }
  return { deleted, remaining: Math.min(versions.length, keepCount) };
}

module.exports = {
  isB2Configured,
  authorize,
  uploadFile,
  downloadFile,
  downloadBuffer,
  getFileInfo,
  deleteFileVersion,
  pruneOldFileVersions,
  listFiles,
  syncLocalPapersToB2,
  restorePapersFromB2,
  uploadPaperCsv,
  B2_BUCKET_NAME
};
