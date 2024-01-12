import { Effect, pipe } from "effect";
import { Move, PokeApiError, Pokemon } from "../common/types";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const POKEMON_DOMAIN = "pokemon";

export const fetchPokemonData = (pokemon: string) =>
  Effect.tryPromise({
    try: async () => {
      const url = `${POKEAPI_BASE}/${POKEMON_DOMAIN}/${pokemon}`;
      const res = await fetch(url);
      const json = await res.json();
      return json as Pokemon;
    },
    catch: (err) =>
      new PokeApiError(`Could not find informations for ${pokemon}`),
  });

export const fetchMove = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url);
      const json = await res.json();
      return json as Move;
    },
    catch: (err) => new PokeApiError("could not get move"),
  });

export const findStrongest = (moves: Move[]): Move =>
  moves.reduce(
    (acc, { power, pp, name }) => {
      if (power > acc.power) {
        return {
          power,
          pp,
          name,
        };
      }

      return acc;
    },
    { power: 0, pp: 0, name: "" }
  );

export const findStrongestMove = (search: string) =>
  pipe(
    // Fetch all the Pokemon
    fetchPokemonData(search),
    // Get all the moves
    Effect.map((a) => a.moves),
    // Using flatMap as we return another layer of Effect
    Effect.flatMap((moves) => {
      const seq = moves.map((m) => m.move.url);
      // Like Promise.all but with better concurrency options, also handles Effect
      return Effect.all(seq.map((s) => fetchMove(s)));
    }),
    //  Find
    Effect.map(findStrongest)
  );

export const findStrongestMoveGen = (pokemon: string) =>
  Effect.gen(function* (_) {
    const pokemons = yield* _(fetchPokemonData(pokemon));
    const movesData = pokemons.moves;
    const moves = yield* _(
      Effect.all(movesData.map((move) => fetchMove(move.move.url)))
    );
    const move = findStrongest(moves);
    return move;
  });
