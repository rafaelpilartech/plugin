const SftpClient = require("ssh2-sftp-client");
const path = require("path");

async function listRemoteFilesRecursive(sftp, remotePath, basePath = remotePath) {
  const result = {};

  const exists = await sftp.exists(remotePath);
  if (!exists) return result;

  const items = await sftp.list(remotePath);

  for (const item of items) {
    const fullPath = `${remotePath}/${item.name}`.replace(/\\/g, "/");
    const relativePath = fullPath.replace(basePath + "/", "");

    if (item.type === "d") {
      const child = await listRemoteFilesRecursive(sftp, fullPath, basePath);
      Object.assign(result, child);
    } else {
      result[relativePath] = {
        path: relativePath,
        size: Number(item.size || 0)
      };
    }
  }

  return result;
}

function uniqueDirsFromFiles(filePaths) {
  const dirs = new Set();

  for (const filePath of filePaths) {
    const normalized = String(filePath || "").replace(/\\/g, "/");
    const parts = normalized.split("/");

    if (parts.length <= 1) continue;

    let current = "";
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      dirs.add(current);
    }
  }

  return Array.from(dirs).sort();
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
    const {
      email,
      server_user,
      ssh_host,
      ssh_port,
      ssh_user,
      ssh_password,
      files
    } = req.body || {};

    if (!email || !server_user || !ssh_host || !ssh_user || !ssh_password) {
      return res.status(400).json({
        ok: false,
        erro: "email, server_user, ssh_host, ssh_user e ssh_password são obrigatórios"
      });
    }

    if (!Array.isArray(files)) {
      return res.status(400).json({
        ok: false,
        erro: "files deve ser um array"
      });
    }

    const host = String(ssh_host)
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const port = Number(ssh_port || 22);
    const username = ssh_user;

    const remoteBasePath = "/projetos";

    sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      password: ssh_password
    });

    const remoteFilesMap = await listRemoteFilesRecursive(sftp, remoteBasePath);

    await sftp.end();
    sftp = null;

    const uploadNeeded = [];
    const localPaths = [];

    for (const file of files) {
      const localPath = String(file?.path || "").replace(/\\/g, "/").trim();
      const localSize = Number(file?.size || 0);

      if (!localPath) continue;

      localPaths.push(localPath);

      const remote = remoteFilesMap[localPath];

      if (!remote) {
        uploadNeeded.push(localPath);
        continue;
      }

      if (Number(remote.size || 0) !== localSize) {
        uploadNeeded.push(localPath);
      }
    }

    const mkdirNeeded = uniqueDirsFromFiles(uploadNeeded);

    return res.status(200).json({
      ok: true,
      email,
      server_user,
      remote_path: remoteBasePath,
      total_local_files: files.length,
      total_remote_files: Object.keys(remoteFilesMap).length,
      upload_needed: uploadNeeded,
      mkdir_needed: mkdirNeeded,
      mode: "size-based-diff"
    });
  } catch (error) {
    try {
      if (sftp) await sftp.end();
    } catch (e) {}

    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao planejar upload"
    });
  }
};
