const SftpClient = require("ssh2-sftp-client");

async function removeDirContentsRecursive(sftp, remotePath) {
  const exists = await sftp.exists(remotePath);
  if (!exists) return;

  const items = await sftp.list(remotePath);

  for (const item of items) {
    const full = `${remotePath}/${item.name}`;

    if (item.type === "d") {
      await removeDirContentsRecursive(sftp, full);
      try {
        await sftp.rmdir(full, true);
      } catch (e) {}
    } else {
      await sftp.delete(full);
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      erro: "Método não permitido",
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
        erro: "email, server_user, ssh_host, ssh_user e ssh_password são obrigatórios",
      });
    }

    const host = String(ssh_host).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const port = Number(ssh_port || 22);
    const username = ssh_user;

    const remoteUserPath = `/projetos`;

    const sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      password: ssh_password,
    });

    try {
      await removeDirContentsRecursive(sftp, remoteUserPath);
    } finally {
      await sftp.end();
    }

    return res.status(200).json({
      ok: true,
      deleted: true,
      remote_path: remoteUserPath,
      email,
      server_user,
      mode: "wipe-server-folder-contents"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao apagar conteúdo do servidor",
    });
  }
};
