const fs = require("fs");
const os = require("os");
const path = require("path");
const { formidable } = require("formidable");

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      erro: "Método não permitido"
    });
  }

  try {
    const { fields, files } = await parseForm(req);

    const upload_id = String(fields.upload_id || "").trim();
    const chunk_index = Number(fields.chunk_index);
    const total_chunks = Number(fields.total_chunks);

    if (!upload_id || Number.isNaN(chunk_index) || Number.isNaN(total_chunks)) {
      return res.status(400).json({
        ok: false,
        erro: "upload_id, chunk_index e total_chunks são obrigatórios"
      });
    }

    let chunkFile = files.file || files.chunk || null;
    if (Array.isArray(chunkFile)) {
      chunkFile = chunkFile[0];
    }

    if (!chunkFile || !chunkFile.filepath) {
      return res.status(400).json({
        ok: false,
        erro: "arquivo de chunk obrigatório"
      });
    }

    const tempDir = path.join(os.tmpdir(), "ybymaps-chunked", upload_id);

    if (!fs.existsSync(tempDir)) {
      return res.status(404).json({
        ok: false,
        erro: "upload_id não encontrado"
      });
    }

    const chunkName = String(chunk_index).padStart(6, "0") + ".part";
    const targetPath = path.join(tempDir, chunkName);

    fs.copyFileSync(chunkFile.filepath, targetPath);

    return res.status(200).json({
      ok: true,
      upload_id,
      chunk_index,
      total_chunks,
      saved_as: chunkName
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message || "erro ao receber chunk"
    });
  }
};
