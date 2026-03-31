export default async function handler(req, res) {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ ok: false, erro: "email obrigatório" });
  }

  try {
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
      return res.status(404).json({ ok: false });
    }

    return res.status(200).json({
      ok: true,
      usuario: usuario
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      erro: e.message
    });
  }
}
