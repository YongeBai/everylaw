import type { Metadata } from "next";
import { RHeader } from "@/components/reader/header";
import { RandomFeed } from "@/components/reader/random-feed";
import styles from "../reader.module.css";

export const metadata: Metadata = { title: "Random sections", description: "An endless stack of random sections of the U.S. Code. Read one, then keep or dissolve it." };

export default function RandomPage() {
  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell} style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 860 }}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>random sections</h1>
        <RandomFeed />
      </main>
    </div>
  </div>;
}
