import { useCallback, useState } from "react";
import { Button, Divider, Flex, Grid, Input, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { useApduForm } from "@/hooks/useApduForm";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useSessionContext } from "@/reducers/sessions";

const Root = styled(Flex).attrs({ mx: 15, mt: 10, mb: 5 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Title = styled(Text).attrs({
  variant: "large",
  fontSize: 18,
  mt: 8,
})``;

const FormContainer = styled(Flex)`
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
  height: 100%;
  width: 100%;
  flex-direction: column;
  border-radius: 12px;
`;

const FormHeader = styled(Flex).attrs({ px: 8, py: 6 })``;

const Form = styled(Flex).attrs({ my: 6, px: 10 })`
  flex: 1;
  flex-direction: column;
  justify-content: center;
`;

const FormFooter = styled(Flex).attrs({ my: 8, px: 8 })`
  flex-direction: row;
  justify-content: flex-end;
  align-self: flex-end;
  align-items: flex-end;
`;

const FormFooterButton = styled(Button).attrs({
  variant: "main",
  size: "large",
  color: "neutral.c00",
})``;

const InputContainer = styled(Flex).attrs({ mx: 8, mb: 4 })`
  flex-direction: column;
  min-width: 150px;
`;

const inputContainerProps = { style: { borderRadius: 4 } };

export const ApduView: React.FC = () => {
  const { apduFormValues, setApduFormValue, apdu } = useApduForm();
  const [loading, setLoading] = useState(false);
  const sdk = useSdk();
  const {
    state: { selected: selectedSessionId },
  } = useSessionContext();
  const onSubmit = useCallback(async () => {
    setLoading(true);
    await sdk.sendApdu({
      sessionId: selectedSessionId!,
      apdu,
    });
    setLoading(false);
  }, [apdu, sdk, selectedSessionId]);
  return (
    <Root>
      <FormContainer>
        <FormHeader>
          <Title>APDU</Title>
        </FormHeader>
        <Divider my={4} />
        <Form>
          <Grid columns={2}>
            <InputContainer>
              <Text variant="body" mb={4}>
                Class instruction
              </Text>
              <Input
                name="instruction"
                containerProps={inputContainerProps}
                value={apduFormValues.classInstruction}
                onChange={(value) =>
                  setApduFormValue("classInstruction", value)
                }
              />
            </InputContainer>
            <InputContainer>
              <Text variant="body" mb={4}>
                Instruction method
              </Text>
              <Input
                name="instructionMethod"
                containerProps={inputContainerProps}
                value={apduFormValues.instructionMethod}
                onChange={(value) =>
                  setApduFormValue("instructionMethod", value)
                }
              />
            </InputContainer>
            <InputContainer>
              <Text variant="body" mb={4}>
                Parameter 1
              </Text>
              <Input
                name="firstParameter"
                containerProps={inputContainerProps}
                value={apduFormValues.firstParameter}
                onChange={(value) => setApduFormValue("firstParameter", value)}
              />
            </InputContainer>
            <InputContainer>
              <Text variant="body" mb={4}>
                Parameter 2
              </Text>
              <Input
                name="secondParameter"
                containerProps={inputContainerProps}
                value={apduFormValues.secondParameter}
                onChange={(value) => setApduFormValue("secondParameter", value)}
              />
            </InputContainer>
            <InputContainer>
              <Text variant="body" mb={4}>
                Data
              </Text>
              <Input
                name="data"
                placeholder="<NO DATA>"
                containerProps={inputContainerProps}
                value={apduFormValues.data}
                onChange={(value) => setApduFormValue("data", value)}
              />
            </InputContainer>
            <InputContainer>
              <Text variant="body" mb={4}>
                Data length
              </Text>
              <Input
                name="dataLength"
                disabled
                containerProps={inputContainerProps}
                value={apduFormValues.dataLength}
                onChange={(value) => setApduFormValue("dataLength", value)}
              />
            </InputContainer>
          </Grid>
        </Form>
        <Divider my={4} />
        <FormFooter my={8}>
          <FormFooterButton onClick={onSubmit} disabled={loading}>
            <Text color="neutral.c00">Send APDU</Text>
          </FormFooterButton>
        </FormFooter>
      </FormContainer>
    </Root>
  );
};
