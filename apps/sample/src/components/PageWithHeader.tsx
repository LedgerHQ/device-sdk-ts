import React from "react";
import { Divider, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

type Segment = {
  label: string;
  value: string;
};

type BreadcrumbSegmentProps = {
  segments: Segment[];
  onChange: (values: string[]) => void;
};

const Root = styled(Flex).attrs({ px: 6 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Flex)`
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  width: 100%;
`;

const Header = styled(Flex).attrs({ pt: 9 })``;

const BreadcrumbLink = styled(Text).attrs({
  fontWeight: "semiBold",
  fontSize: 3,
  color: "neutral.c80",
  tabIndex: 0,
})`
  cursor: pointer;
  &:hover,
  &:active,
  &:focus {
    color: ${(p) => p.theme.colors.neutral.c100};
    text-decoration: underline;
  }
`;

const KeyedBreadcrumb: React.FC<BreadcrumbSegmentProps> = ({
  segments,
  onChange,
}) => (
  <Flex columnGap={5} alignItems="center">
    {segments.map((segment, index) => {
      const valuesUpToHere = segments.slice(0, index + 1).map((s) => s.value);
      return (
        <React.Fragment key={segment.value}>
          {index > 0 && (
            <Text fontWeight="semiBold" color="neutral.c40" variant="paragraph">
              /
            </Text>
          )}
          <BreadcrumbLink
            onKeyDown={(event: React.KeyboardEvent) =>
              ["Enter", " "].includes(event.key) && onChange(valuesUpToHere)
            }
            onClick={() => onChange(valuesUpToHere)}
          >
            {segment.label}
          </BreadcrumbLink>
        </React.Fragment>
      );
    })}
  </Flex>
);

export const PageWithHeader: React.FC<
  {
    children: React.ReactNode;
  } & ({ title: string } | BreadcrumbSegmentProps)
> = (props) => {
  const { children } = props;
  const headerContent =
    "title" in props ? (
      <KeyedBreadcrumb
        segments={[{ label: props.title, value: props.title }]}
        onChange={() => {}}
      />
    ) : (
      <KeyedBreadcrumb {...props} />
    );
  return (
    <Root overflow="hidden">
      <Container>
        <Header>{headerContent}</Header>
        <Divider my={4} />
        {children}
      </Container>
    </Root>
  );
};
