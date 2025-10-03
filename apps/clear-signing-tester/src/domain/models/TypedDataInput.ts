/**
 * Domain model representing a typed data input
 */
export interface TypedDataInput {
    data: string;
    description?: string;
    expectedTexts?: string[];
}
