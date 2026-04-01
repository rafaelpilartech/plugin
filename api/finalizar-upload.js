const fs = require("fs");
const os = require("os");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

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
    const { upload_id } = req.body || {};

    if (!upload_id) {
      return res.status(400).json({
        ok: false,
        erro: "upload_id é obrigatório"
      });
    }

    const tempDir = path.join(os.tmpdir(), "ybymaps-chunked", upload_id);
    const metaPath = path.join(tempDir, "meta.json");

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({
        ok: false,
        erro: "meta.json não encontrado para este upload"
      });
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

    const {
      ssh_host,
      ssh_port,
      ssh_user,
      ssh_password,
      relative_path,
      total_chunks,
      email,
      server_user
    } = meta;

    const assembledPath = path.join(tempDir, "assembled.bin");
    const writeStream = fs.createWriteStream(assembledPath);

    for (let i = 0; i < Number(total_chunks); i++) {
      const chunkName = String(i).padStart(6, "0") + ".part";
      const chunkPath = path.join(tempDir, chunkName);

      if (!fs.existsSync(chunkPath)) {
        writeStream.close();
        return res.status(400).json({
          ok: false,
          erro: `chunk ausente: ${chunkName}`
        });
      }

      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }

    await new Promise((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on("error", reject);
    });

    const host = String(ssh_host).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const port = Number(ssh_port || 22);
    const username = ssh_user;

    const cleanRelativePath = String(relative_path)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");

    const remoteBasePath = "/projetos";
    const remoteFullPath = `${remoteBasePath}/${cleanRelativePath}`;
    const remoteDir = path.posix.dirname(remoteFullPath);

    sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      password: ssh_password
    });

    await ensureRemoteDir(sftp, remoteDir);
    await sftp.put(assembledPath, remoteFullPath);

    await sftp.end();
    sftp = null;

    fs.rmSync(tempDir, { recursive: true, force: true });

    return res.status(200).json({
      ok: true,
      upload_id,
      uploaded: true,
      email,
      server_user,
      relative_path: cleanRelativePath,
      remote_path: remoteFullPath,
      mode: "chunked-upload-finalized"
    });
  } catch (error) {
    try {
      if (sftp) await sftp.end();
    } catch (e) {}

    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao finalizar upload"
    });
  }
};
