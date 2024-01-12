export class PokeApiError {
  readonly _tag = "PokeApiError";
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

export interface MoveMeta {
  move: {
    name: string;
    url: string;
  };
}

export interface Pokemon {
  id: number;
  name: string;
  moves: MoveMeta[];
}

export interface Move {
  name: string;
  power: number;
  pp: number;
}
