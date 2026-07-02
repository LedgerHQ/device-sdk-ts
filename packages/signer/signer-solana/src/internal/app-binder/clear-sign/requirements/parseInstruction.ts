import {
  fromCalAccountReset,
  fromCalDisplayField,
  fromCalInstructionInfo,
  fromCalValueFlowPort,
} from "./fromCal";
import { type InstructionDescriptor } from "./model";
import { type ParsedInstruction } from "./records";

/**
 * Map a matched CAL descriptor's decoded JSON into the structured records the
 * requirement builder consumes. HIDE_RULE substructures are not carried — they
 * only drive post-resolution witness logic, out of scope here.
 */
export function parseInstructionDescriptor(
  descriptor: InstructionDescriptor,
): ParsedInstruction {
  return {
    info: fromCalInstructionInfo(
      descriptor.idlDescriptor,
      descriptor.mintAssociations,
    ),
    valueFlowPorts: descriptor.valueFlowPorts.map(fromCalValueFlowPort),
    accountResets: descriptor.accountResets.map(fromCalAccountReset),
    displayFields: descriptor.displayFields.map(fromCalDisplayField),
  };
}
