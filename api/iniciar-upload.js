const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

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
      ssh_password,
      relative_path,
      file_size,
      total_chunks
    } = req.body || {};

    if (
      !email ||
      !server_user ||
      !ssh_host ||
      !ssh_user ||
      !ssh_password ||
      !relative_path ||
      file_size === undefined ||
      total_chunks === undefined
    ) {
      return res.status(400).json({
        ok: false,
        erro: "campos obrigatórios ausentes"
      });
    }

    const upload_id = crypto.randomUUID();
    const tempDir = path.join(os.tmpdir(), "ybymaps-chunked", upload_id);

    fs.mkdirSync(tempDir, { recursive: true });

    const meta = {
      email,
      server_user,
      ssh_host,
      ssh_port: Number(ssh_port || 22),
      ssh_user,
      ssh_password,
      relative_path: String(relative_path).replace(/\\/g, "/"),
      file_size: Number(file_size || 0),
      total_chunks: Number(total_chunks || 0),
      created_at: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(tempDir, "meta.json"),
      JSON.stringify(meta, null, 2),
      "utf-8"
    );

    return res.status(200).json({
      ok: true,
      upload_id,
      temp_dir: tempDir,
      total_chunks: meta.total_chunks
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao iniciar upload"
    });
  }
};
