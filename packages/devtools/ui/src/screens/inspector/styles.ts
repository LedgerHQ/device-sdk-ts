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

// Status badge styles
type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

const badgeColors: Record<
  BadgeVariant,
  { bg: string; border: string; text: string; dot: string }
> = {
  success: {
    bg: "#e8f5e9",
    border: "#c8e6c9",
    text: "#2e7d32",
    dot: "#4CAF50",
  },
  warning: {
    bg: "#fff3e0",
    border: "#ffe0b2",
    text: "#e65100",
    dot: "#ff9800",
  },
  error: { bg: "#ffebee", border: "#ffcdd2", text: "#c62828", dot: "#ff4444" },
  info: { bg: "#e3f2fd", border: "#bbdefb", text: "#1565c0", dot: "#2196F3" },
  neutral: {
    bg: "#f5f5f5",
    border: "#e0e0e0",
    text: "#616161",
    dot: "#9e9e9e",
  },
};

export const StatusBadge = styled.span<{ $variant: BadgeVariant }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 18px;
  white-space: nowrap;
  background: ${({ $variant }) => badgeColors[$variant].bg};
  border: 1px solid ${({ $variant }) => badgeColors[$variant].border};
  color: ${({ $variant }) => badgeColors[$variant].text};

  &::before {
    content: "";
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $variant }) => badgeColors[$variant].dot};
  }
`;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

// Collapsible section styles
export const CollapsibleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`;

export const CollapsibleToggle = styled.span<{ $expanded: boolean }>`
  font-size: 10px;
  color: #666;
  transition: transform 0.15s ease;
  transform: rotate(${({ $expanded }) => ($expanded ? "90deg" : "0deg")});
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
`;

export const CollapsibleContent = styled.div<{ $expanded: boolean }>`
  display: ${({ $expanded }) => ($expanded ? "flex" : "none")};
  flex-direction: column;
  gap: 8px;
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
