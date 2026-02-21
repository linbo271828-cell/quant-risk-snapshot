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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signup-api",hypothesisId:"H2",location:"app/api/auth/signup/route.ts:POST:input",message:"Signup request parsed",data:{usernameValid:Boolean(username),passwordLength:password.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!username) {
      return NextResponse.json(
        { error: "Username must be 3-24 chars and use only letters, numbers, and underscore." },
        { status: 400 },
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signup-api",hypothesisId:"H2",location:"app/api/auth/signup/route.ts:POST:existing",message:"Signup blocked by duplicate username",data:{duplicate:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true },
    });
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signup-api",hypothesisId:"H2",location:"app/api/auth/signup/route.ts:POST:created",message:"User created successfully",data:{created:true,userIdLength:user.id.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"signup-api",hypothesisId:"H5",location:"app/api/auth/signup/route.ts:POST:catch",message:"Signup route threw error",data:{errorMessage:msg},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
