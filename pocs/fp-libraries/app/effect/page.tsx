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
  const [error, setError] = useState<string | null>();

  const onClick = async (
    e: SyntheticEvent<HTMLFormElement | HTMLButtonElement>
  ) => {
    e.preventDefault();
    if (!inputRef?.current?.value) return;

    Effect.runPromise(
      findStrongestMoveGen(inputRef.current.value).pipe(
        Effect.catchAll((err) => {
          setResult(null);
          setPokemon("");
          setError(err.message);
          return Effect.fail(err);
        })
      )
    ).then((move) => {
      setResult(move);
      setPokemon(inputRef?.current?.value);
      setError(null);
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
      {error ? (
        <section className={`${styles.main} ${styles.sub}`}>
          <h2>Error</h2>
          <section className={styles.main}>
            <p>{error}</p>
          </section>
        </section>
      ) : null}
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
