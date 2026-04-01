const SftpClient = require("ssh2-sftp-client");
const formidable = require("formidable");
const path = require("path");

module.exports.config = {
  api: {
    bodyParser: false
  }
};

function parseForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function ensureRemoteDir(sftp, remotePath) {
  const normalized = String(remotePath || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    const exists = await sftp.exists(current);
    if (!exists) {
      await sftp.mkdir(current);
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      erro: "Método não permitido"
    });
  }

  let sftp = null;

  try {
    const { fields, files } = await parseForm(req);

    const email = String(fields.email || "").trim();
    const server_user = String(fields.server_user || "").trim();
    const ssh_host = String(fields.ssh_host || "").trim();
    const ssh_port = Number(fields.ssh_port || 22);
    const ssh_user = String(fields.ssh_user || "").trim();
    const ssh_password = String(fields.ssh_password || "").trim();
    const relative_path = String(fields.relative_path || "").trim();

    if (!email || !server_user || !ssh_host || !ssh_user || !ssh_password || !relative_path) {
      return res.status(400).json({
        ok: false,
        erro: "email, server_user, ssh_host, ssh_user, ssh_password e relative_path são obrigatórios"
      });
    }

    let uploadFile = files.file || null;
    if (Array.isArray(uploadFile)) {
      uploadFile = uploadFile[0];
    }

    if (!uploadFile || !uploadFile.filepath) {
      return res.status(400).json({
        ok: false,
        erro: "arquivo obrigatório no campo file"
      });
    }

    const host = ssh_host.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const port = Number(ssh_port || 22);
    const username = ssh_user;

    const cleanRelativePath = relative_path
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");

    if (!cleanRelativePath) {
      return res.status(400).json({
        ok: false,
        erro: "relative_path inválido"
      });
    }

    const remoteBasePath = "/projetos";
    const remoteFullPath = `${remoteBasePath}/${cleanRelativePath}`.replace(/\\/g, "/");
    const remoteDir = path.posix.dirname(remoteFullPath);

    sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      password: ssh_password
    });

    await ensureRemoteDir(sftp, remoteDir);
    await sftp.put(uploadFile.filepath, remoteFullPath);

    await sftp.end();
    sftp = null;

    return res.status(200).json({
      ok: true,
      uploaded: true,
      email,
      server_user,
      relative_path: cleanRelativePath,
      remote_path: remoteFullPath,
      mode: "single-file-upload"
    });
  } catch (error) {
    try {
      if (sftp) await sftp.end();
    } catch (e) {}

    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao enviar arquivo"
    });
  }
};
