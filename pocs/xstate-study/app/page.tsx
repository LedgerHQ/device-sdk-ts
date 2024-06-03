"use client";

import { useEffect } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import Machine from "./Machine";

export default function Home() {
  useEffect(() => {
    console.log("Hello, world!");
  }, []);
  return (
    <main className={styles.main}>
      <Machine />
    </main>
  );
}
