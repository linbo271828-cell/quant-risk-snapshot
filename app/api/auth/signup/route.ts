import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "../../../../lib/db";

type SignUpBody = {
  username?: string;
  password?: string;
};

function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (username.length < 3 || username.length > 24) return null;
  if (!/^[a-z0-9_]+$/.test(username)) return null;
  return username;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignUpBody;
    const username = validateUsername(body.username ?? "");
    const password = body.password ?? "";

    if (!username) {
      return NextResponse.json(
        { error: "Username must be 3-24 chars and use only letters, numbers, and underscore." },
        { status: 400 },
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) return NextResponse.json({ error: "Username already exists." }, { status: 409 });

    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true },
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
