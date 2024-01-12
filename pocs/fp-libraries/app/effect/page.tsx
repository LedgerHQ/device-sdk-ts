"use client";

import { SyntheticEvent, useRef, useState } from "react";
import { Move } from "../common/types";
import "../common/global.css";
import styles from "../common/page.module.css";
import { findStrongestMoveGen } from "./utils";
import { Effect } from "effect";

export default function Page() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Move | null>();
  const [pokemon, setPokemon] = useState<string>();

  const onClick = async (
    e: SyntheticEvent<HTMLFormElement | HTMLButtonElement>
  ) => {
    e.preventDefault();
    if (!inputRef?.current?.value) return;

    Effect.runPromise(findStrongestMoveGen(inputRef.current.value))
      .then((move) => {
        setResult(move);
        setPokemon(inputRef?.current?.value);
      })
      .catch((reason): void => {
        console.log(reason);
        setResult(null);
        setPokemon("");
      });
  };

  return (
    <>
      <section className={styles.main}>
        <h1>Effect Example</h1>
      </section>
      <form className={styles.searchMain} onSubmit={onClick}>
        <input ref={inputRef} className={styles.search} type="search" />
        <button className={styles.button} type="submit" onClick={onClick}>
          Search
        </button>
      </form>
      {result ? (
        <section className={`${styles.main} ${styles.sub}`}>
          <h2>Result</h2>
          <section className={styles.main}>
            <ul>
              <li>
                Name: <strong>{pokemon}</strong>
              </li>
              <li>
                Move name: <strong>{result.name.split("-").join(" ")}</strong>
              </li>
              <li>
                Power: <strong>{result.power}</strong>
              </li>
              <li>
                PP: <strong>{result.pp}</strong>
              </li>
            </ul>
          </section>
        </section>
      ) : null}
    </>
  );
}
