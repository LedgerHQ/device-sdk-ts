import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

/**
 * Generic context field loader that can be used for Ethereum (ClearSign),
 * Solana, or any other chain.
 *
 * - TInput:   input type for the loader (field / context object)
 * - TType:    enum/union of possible context types
 * - TContext: union of context objects (must have a `type` discriminator)
 */
export interface ContextFieldLoader<
  TInput = unknown,
  TType extends string | number = ClearSignContextType,
  TContext extends { type: string | number } = ClearSignContext,
> {
  /**
   * @param field - The field to load
   * @returns The loaded context
   */
  loadField: (field: TInput) => Promise<TContext>;

  /**
   * @param field - The field to check
   * @param expectedType - The type of the context to load
   * @returns True if the loader can handle the field, false otherwise
   */
  canHandle: (field: unknown, expectedType: TType) => field is TInput;
}
