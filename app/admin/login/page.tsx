import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Sign in · Admin",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className={styles.narrow}>
      <h1>Admin sign-in</h1>
      <Suspense fallback={null}><LinkError searchParams={searchParams} /></Suspense>
      <p className={styles.lede}>Enter your email and we&apos;ll send you a sign-in link. Only admins can sign in.</p>
      <LoginForm />
      <p className={styles.note}>Not set up with email yet? <a href="/admin/basic">Use the shared password</a> (temporary).</p>
    </div>
  );
}

async function LinkError({ searchParams }: { searchParams: SP }) {
  const { error } = await searchParams;
  return error === "link" ? <p className={styles.err} role="alert">That link has expired or was already used. Ask for a new one.</p> : null;
}
