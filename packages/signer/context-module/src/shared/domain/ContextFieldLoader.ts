import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export interface ContextFieldLoader<TInput = unknown> {
  /**
   * @param field - The field to load
   * @returns The loaded context
   */
  loadField: (field: TInput) => Promise<ClearSignContext>;

  /**
   * @param field - The field to load
   * @param expectedType - The type of the context to load
   * @returns True if the loader can handle the field, false otherwise
   */
  canHandle: (field: unknown, expectedType: ClearSignContextType) => boolean;
}
