import { NextResponse } from "next/server";
import SftpClient from "ssh2-sftp-client";

function getPrivateKey() {
  return (process.env.SSH_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

async function removeDirRecursive(sftp: any, remotePath: string) {
  const exists = await sftp.exists(remotePath);
  if (!exists) return;

  const items = await sftp.list(remotePath);

  for (const item of items) {
    const full = `${remotePath}/${item.name}`;

    if (item.type === "d") {
      await removeDirRecursive(sftp, full);
      await sftp.rmdir(full, true);
    } else {
      await sftp.delete(full);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body?.email || "").trim();
    const server_user = String(body?.server_user || "").trim();
    const project_name = String(body?.project_name || "").trim();

    if (!email || !server_user || !project_name) {
      return NextResponse.json(
        { ok: false, erro: "email, server_user e project_name são obrigatórios" },
        { status: 400 }
      );
    }

    const host = "35.232.156.225";
    const port = 22;
    const username = process.env.MANAGED_SSH_USER || "root";
    const privateKey = getPrivateKey();

    const remoteProjectPath = `/srv/projects/${server_user}/${project_name}`;

    const sftp = new SftpClient();

    await sftp.connect({
      host,
      port,
      username,
      privateKey,
    });

    try {
      await removeDirRecursive(sftp, remoteProjectPath);

      const exists = await sftp.exists(remoteProjectPath);
      if (exists) {
        await sftp.rmdir(remoteProjectPath, true);
      }
    } finally {
      await sftp.end();
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      project_name,
      remote_path: remoteProjectPath,
      email,
      server_user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        erro: error?.message || "erro ao apagar projeto",
      },
      { status: 500 }
    );
  }
}
