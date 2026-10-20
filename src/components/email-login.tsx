"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase-client";

const messages: Record<string, string> = {
  "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
  "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않아요.",
  "auth/user-not-found": "가입된 이메일이 아니에요. 먼저 가입해주세요.",
  "auth/email-already-in-use": "이미 가입된 이메일이에요. 로그인하거나, Google로 가입했다면 Google로 시작해주세요.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 해요.",
  "auth/invalid-email": "이메일 주소를 확인해주세요.",
  "auth/too-many-requests": "시도가 너무 많아요. 잠시 후 다시 해주세요.",
  "auth/operation-not-allowed": "이메일 로그인이 아직 켜져 있지 않아요. 운영자에게 알려주세요.",
  "auth/network-request-failed": "인터넷 연결을 확인해주세요.",
};
const explain = (e: unknown) => messages[(e as { code?: string })?.code || ""] || "처리하지 못했어요. 잠시 후 다시 해주세요.";

/** Email and password sign-in next to Google. New accounts must confirm their address before entering. */
export function EmailLogin({ disabled }: { disabled?: boolean }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const auth = clientAuth(), address = email.trim();
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, address, password);
      else if (mode === "signup") {
        const { user } = await createUserWithEmailAndPassword(auth, address, password);
        await updateProfile(user, { displayName: name.trim() });
        await sendEmailVerification(user);
      } else {
        await sendPasswordResetEmail(auth, address);
        setNotice("비밀번호를 다시 정하는 메일을 보냈어요. 메일함을 확인해주세요.");
        setMode("login");
      }
    } catch (err) { setError(explain(err)); }
    finally { setBusy(false); }
  }
  const off = disabled || busy || !firebaseConfigured;
  return (
    <form className="email-login" onSubmit={submit}>
      <div className="email-login-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>이메일 로그인</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>이메일로 가입</button>
      </div>
      {mode === "signup" && <label>이름<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="name" placeholder="함께할 사람들에게 보일 이름" disabled={off} /></label>}
      <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com" disabled={off} /></label>
      {mode !== "reset" && <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "6자 이상" : ""} disabled={off} /></label>}
      <button className="email-button" disabled={off}>
        {busy ? <LoaderCircle className="spin" size={18} /> : <Mail size={18} />}
        {mode === "login" ? "이메일로 로그인" : mode === "signup" ? "가입하고 인증 메일 받기" : "재설정 메일 보내기"}<ArrowRight size={16} />
      </button>
      {mode === "login" && <button type="button" className="email-link" onClick={() => { setMode("reset"); setError(""); }}>비밀번호를 잊었어요</button>}
      {mode === "reset" && <button type="button" className="email-link" onClick={() => setMode("login")}>로그인으로 돌아가기</button>}
      {notice && <p className="email-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

/** Shown to an email account that has not confirmed its address yet; nothing else opens until it does. */
export function EmailVerify({ user, onVerified }: { user: User; onVerified: (u: User) => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function check() {
    setBusy(true); setMessage("");
    try {
      await user.reload();
      if (user.emailVerified) { await user.getIdToken(true); onVerified(user); }
      else setMessage("아직 인증되지 않았어요. 메일의 링크를 누른 뒤 다시 눌러주세요.");
    } catch (err) { setMessage(explain(err)); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setMessage("");
    try { await sendEmailVerification(user); setMessage("인증 메일을 다시 보냈어요. 스팸함도 확인해주세요."); }
    catch (err) { setMessage(explain(err)); }
    finally { setBusy(false); }
  }
  return (
    <div className="email-verify">
      <Mail size={28} />
      <h2>메일함을 확인해주세요</h2>
      <p><b>{user.email}</b>로 인증 메일을 보냈어요.<br />메일의 링크를 누른 뒤 아래 버튼을 눌러주세요.</p>
      <button className="email-button" disabled={busy} onClick={check}>{busy ? <LoaderCircle className="spin" size={18} /> : null}인증했어요<ArrowRight size={16} /></button>
      <div className="email-verify-actions">
        <button type="button" className="email-link" disabled={busy} onClick={resend}>인증 메일 다시 보내기</button>
        <button type="button" className="email-link" disabled={busy} onClick={() => signOut(clientAuth())}>다른 계정으로 로그인</button>
      </div>
      {message && <p className="email-notice" role="status">{message}</p>}
    </div>
  );
}
