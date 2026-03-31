const SftpClient = require("ssh2-sftp-client");

function getPrivateKey() {
  return (process.env.SSH_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

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
    const { email, server_user } = req.body || {};

    if (!email || !server_user) {
      return res.status(400).json({
        ok: false,
        erro: "email e server_user são obrigatórios",
      });
    }

    const host = "35.232.156.225";
    const port = 22;
    const username = process.env.MANAGED_SSH_USER || "root";
    const privateKey = getPrivateKey();

    const remoteUserPath = `/srv/projects/${server_user}`;

    const sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      privateKey,
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
      mode: "wipe-user-folder-contents"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao apagar conteúdo do usuário",
    });
  }
};
