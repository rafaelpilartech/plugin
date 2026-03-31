export default async function handler(req, res) {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ ok: false, erro: "email obrigatório" });
  }

  try {
    const resp = await fetch(
      `http://35.232.156.225:9000/usuarios?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TOKEN_VALIDACAO}`
        }
      }
    );

    const usuario = await resp.json();

    if (!usuario || usuario.usuario === null) {
      return res.status(404).json({ ok: false, erro: "usuário não encontrado" });
    }

    return res.status(200).json({
      ok: true,
      plano: usuario.plano,
      user: usuario.user_ubuntu
    });

  } catch (e) {
    return res.status(500).json({ ok: false, erro: "erro na API" });
  }
}
