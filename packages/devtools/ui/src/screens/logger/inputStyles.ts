import styled from "styled-components";

/**
 * Shared container for filter and search inputs.
 * Uses flex: 1 to share available width.
 */
export const InputContainer = styled.div`
  position: relative;
  flex: 1;
  min-width: 150px;
`;

/**
 * Shared wrapper that provides the bordered box appearance.
 * Can contain the input and additional controls (like search nav buttons).
 */
export const InputWrapper = styled.div<{ $focused?: boolean }>`
  display: flex;
  align-items: center;
  height: 28px;
  border: 1px solid ${({ $focused }) => ($focused ? "#999" : "#ccc")};
  border-radius: 4px;
  background-color: #fff;
  overflow: hidden;
`;

/**
 * Shared styled input used in both FilterInput and SearchInput.
 * Border and background are handled by InputWrapper.
 */
export const StyledInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: none;
  font-size: 12px;
  font-family: monospace;
  background-color: transparent;
  color: #333;
  min-width: 0;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: #999;
  }
`;
