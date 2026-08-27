import type { Metadata } from "next";
import { RHeader } from "@/components/r/header";
import { RandomFeed } from "@/components/r/random-feed";
import styles from "../reddit.module.css";

export const metadata: Metadata = { title: "Random laws", description: "An endless stack of random federal laws. Read one, then keep or dissolve it." };

export default function RandomPage() {
  return <div className={styles.page}>
    <RHeader />
    <div className={styles.shell} style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 860 }}>
      <main className={styles.main}>
        <h1 style={{ font: "700 16px Verdana, sans-serif", margin: "6px 4px 12px" }}>random laws</h1>
        <RandomFeed />
      </main>
    </div>
  </div>;
}
