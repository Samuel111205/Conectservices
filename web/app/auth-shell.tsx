import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth.module.css";

export default function EstruturaAutenticacao({
  children,
  account = false,
}: {
  children: ReactNode;
  account?: boolean;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Conect Services — início">
          <span className={styles.brandMark} aria-hidden="true">
            ✦
          </span>
          <span>
            conect<span style={{ color: "#85a842" }}>.</span>
            <small>services</small>
          </span>
        </Link>
      </header>
      <section className={`${styles.card} ${account ? styles.accountCard : ""}`}>
        {children}
      </section>
      <Link className={styles.homeLink} href="/">
        Voltar à página inicial
      </Link>
    </main>
  );
}
