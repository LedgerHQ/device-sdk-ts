import {
  fromCalAccountReset,
  fromCalDisplayField,
  fromCalHideRule,
  fromCalInstructionInfo,
  fromCalValueFlowPort,
} from "./fromCal";
import { type InstructionDescriptor } from "./model";
import { type ParsedInstruction } from "./records";

/**
 * Map a matched CAL descriptor's decoded JSON into the structured records the
 * requirement builder consumes.
 */
export function parseInstructionDescriptor(
  descriptor: InstructionDescriptor,
): ParsedInstruction {
  return {
    info: fromCalInstructionInfo(
      descriptor.idlDescriptor,
      descriptor.mintAssociations,
      descriptor.ownerAssociations,
    ),
    valueFlowPorts: descriptor.valueFlowPorts.map(fromCalValueFlowPort),
    accountResets: descriptor.accountResets.map(fromCalAccountReset),
    displayFields: descriptor.displayFields.map(fromCalDisplayField),
    hideRules: descriptor.hideRules.map(fromCalHideRule),
  };
}
