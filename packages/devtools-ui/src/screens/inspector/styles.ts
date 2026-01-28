import styled, { css } from "styled-components";

// Shared button styles
const buttonBase = css`
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 14px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

export const Button = styled.button<{
  $variant?: "danger" | "success" | "primary" | "warning";
  $size?: "small" | "medium";
}>`
  ${buttonBase}
  background: ${({ $variant }) => {
    switch ($variant) {
      case "danger":
        return "#ff4444";
      case "success":
        return "#4CAF50";
      case "warning":
        return "#ff9800";
      case "primary":
      default:
        return "#2196F3";
    }
  }};
  padding: ${({ $size }) => ($size === "medium" ? "8px 16px" : "4px 12px")};

  &:disabled {
    background: #ccc;
  }
`;

// Card styles
export const Card = styled.div<{
  $variant?: "default" | "discovered" | "disconnected";
}>`
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid
    ${({ $variant }) => {
      switch ($variant) {
        case "discovered":
          return "#cce5ff";
        case "disconnected":
          return "#ddd";
        default:
          return "#ddd";
      }
    }};
  background: ${({ $variant }) => {
    switch ($variant) {
      case "discovered":
        return "#f0f7ff";
      case "disconnected":
        return "#f0f0f0";
      default:
        return "#fafafa";
    }
  }};
  opacity: ${({ $variant }) => ($variant === "disconnected" ? 0.6 : 1)};
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

export const CardHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CardTitle = styled.h5`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const CardSection = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
`;

// Text styles
export const SmallText = styled.p`
  font-size: 12px;
  color: #666;
  margin: 0;
`;

export const MutedText = styled.span`
  font-size: 12px;
  color: #999;
`;

export const ItalicNote = styled.p`
  font-size: 12px;
  color: #999;
  font-style: italic;
  margin: 12px 0 0 0;
`;

export const SectionLabel = styled.p`
  font-size: 12px;
  color: #666;
  font-weight: 600;
  margin: 0 0 4px 0;
`;

// Section styles
export const Section = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
`;

export const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
`;

export const SubsectionTitle = styled.h5`
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: #666;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
`;

export const DeviceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

// Container styles
export const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 16px;
  overflow: auto;
`;

export const CenteredMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px;
  opacity: 0.6;
`;

// NotConnected styles
export const NotConnectedContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px;
  opacity: 0.6;
`;

export const NotConnectedTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 24px;
`;

export const NotConnectedDescription = styled.p`
  text-align: center;
  max-width: 500px;
  margin: 0;
`;

export const CodeBlock = styled.pre`
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 12px;
  overflow: auto;
`;
