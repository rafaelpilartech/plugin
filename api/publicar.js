export default async function handler(req, res) {
  const { email, server_user } = req.body || {};

  if (!email || !server_user) {
    return res.status(400).json({
      ok: false,
      erro: "email e server_user obrigatórios"
    });
  }

  try {
    // 🔹 busca usuário
    const resp = await fetch(
      "http://35.232.156.225:9000/usuarios",
      {
        method: "POST",
        headers: {
          AccessTokenApi: process.env.TOKEN_VALIDACAO,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      }
    );

    const data = await resp.json();
    const usuario = Array.isArray(data) ? data[0] : data;

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        erro: "usuário não encontrado"
      });
    }

    // 🔥 só freemium (0) e cloud (1)
    if (usuario.plano === 0 || usuario.plano === 1) {

      await fetch("http://35.232.156.225:9000/lizmap/create-repository", {
        method: "POST",
        headers: {
          AccessTokenApi: process.env.TOKEN_VALIDACAO,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          folder_name: server_user,
          label: server_user,
          local_path: `/srv/projects/${server_user}/`,
          admin_url: "https://projects.ybymaps.com/admin.php/admin/maps"
        })
      });

    }

    return res.status(200).json({
      ok: true,
      plano: usuario.plano
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      erro: e.message
    });
  }
}
