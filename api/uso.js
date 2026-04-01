const SftpClient = require("ssh2-sftp-client");

async function scanDirRecursive(sftp, remotePath, basePath = remotePath) {
  let totalBytes = 0;
  let items = [];

  const exists = await sftp.exists(remotePath);
  if (!exists) {
    return { totalBytes: 0, items: [] };
  }

  const list = await sftp.list(remotePath);

  for (const item of list) {
    const fullPath = `${remotePath}/${item.name}`;
    const relativePath = fullPath.replace(basePath + "/", "");

    if (item.type === "d") {
      const child = await scanDirRecursive(sftp, fullPath, basePath);
      totalBytes += child.totalBytes;

      items.push({
        name: item.name,
        path: relativePath,
        type: "dir",
        size_bytes: child.totalBytes,
        size_mb: Number((child.totalBytes / 1024 / 1024).toFixed(2))
      });

      items.push(...child.items);
    } else {
      const sizeBytes = Number(item.size || 0);
      totalBytes += sizeBytes;

      items.push({
        name: item.name,
        path: relativePath,
        type: "file",
        size_bytes: sizeBytes,
        size_mb: Number((sizeBytes / 1024 / 1024).toFixed(2))
      });
    }
  }

  return { totalBytes, items };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      erro: "Método não permitido"
    });
  }

  try {
    const {
      email,
      server_user,
      ssh_host,
      ssh_port,
      ssh_user,
      ssh_password
    } = req.body || {};

    if (!email || !server_user || !ssh_host || !ssh_user || !ssh_password) {
      return res.status(400).json({
        ok: false,
        erro: "email, server_user, ssh_host, ssh_user e ssh_password são obrigatórios"
      });
    }

    const host = String(ssh_host)
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const port = Number(ssh_port || 22);
    const username = ssh_user;

    const remoteUserPath = "/projetos";

    const sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      password: ssh_password
    });

    try {
      const scan = await scanDirRecursive(sftp, remoteUserPath);

      const topLevel = scan.items.filter(item => !item.path.includes("/"));

      return res.status(200).json({
        ok: true,
        email,
        server_user,
        remote_path: remoteUserPath,
        used_bytes: scan.totalBytes,
        used_mb: Number((scan.totalBytes / 1024 / 1024).toFixed(2)),
        items: scan.items,
        top_level_items: topLevel
      });
    } finally {
      await sftp.end();
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao consultar uso do servidor"
    });
  }
};
