import { type InstructionDescriptor, SubstructureKind } from "./model";
import {
  parseAccountReset,
  parseDisplayField,
  parseInstructionInfo,
  parseValueFlowPort,
} from "./parseSubstructures";
import { type ParsedInstruction } from "./records";

/**
 * Parse a matched CAL descriptor's INSTRUCTION_INFO and substructure TLVs into
 * structured records grouped by kind. HIDE_RULE substructures are ignored —
 * they only drive post-resolution witness logic, out of scope here.
 */
export function parseInstructionDescriptor(
  descriptor: InstructionDescriptor,
): ParsedInstruction {
  const parsed: ParsedInstruction = {
    info: parseInstructionInfo(descriptor.instructionInfo),
    valueFlowPorts: [],
    accountResets: [],
    displayFields: [],
  };

  for (const { kind, data } of descriptor.substructures) {
    switch (kind) {
      case SubstructureKind.VALUE_FLOW_PORT:
        parsed.valueFlowPorts.push(parseValueFlowPort(data));
        break;
      case SubstructureKind.ACCOUNT_RESET:
        parsed.accountResets.push(parseAccountReset(data));
        break;
      case SubstructureKind.DISPLAY_FIELD:
        parsed.displayFields.push(parseDisplayField(data));
        break;
      default:
        break;
    }
  }

  return parsed;
}
