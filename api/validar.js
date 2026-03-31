export default async function handler(req, res) {
  const { email } = req.body || {};

  return res.status(200).json({
    ok: true,
    email_recebido: email || null
  });
}
// update
