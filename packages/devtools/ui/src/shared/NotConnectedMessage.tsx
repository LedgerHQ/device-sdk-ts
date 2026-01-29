import React from "react";
import styled from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px;
  opacity: 0.6;
`;

const Title = styled.h3`
  margin: 0 0 16px 0;
  font-size: 24px;
`;

const Description = styled.p`
  text-align: center;
  max-width: 500px;
  margin: 0;
`;

const CodeBlock = styled.pre`
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 12px;
  overflow: auto;
`;

type Props = {
  title: string;
  description: React.ReactNode;
  codeExample: string;
};

export const NotConnectedMessage: React.FC<Props> = ({
  title,
  description,
  codeExample,
}) => (
  <Container>
    <Title>{title}</Title>
    <Description>{description}</Description>
    <CodeBlock>{codeExample}</CodeBlock>
  </Container>
);
