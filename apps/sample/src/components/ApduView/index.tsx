import React, { useCallback, useState } from "react";
import { type ApduResponse } from "@ledgerhq/device-management-kit";
import { Button, Divider, Flex, Grid, Input, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { useApduForm } from "@/hooks/useApduForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

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

const ResultDescText = styled(Text).attrs({ variant: "body", mt: 4, px: 8 })`
  min-width: 150px;
  display: inline-block;
`;

const FieldName = styled(Text).attrs({ mb: 4 })``;

export const ApduView: React.FC = () => {
  const { apduFormValues, setApduFormValue, getRawApdu, getHexString } =
    useApduForm();
  const [loading, setLoading] = useState(false);
  const [apduResponse, setApduResponse] = useState<ApduResponse>();
  const dmk = useDmk();
  const {
    state: { selectedId: selectedSessionId },
  } = useDeviceSessionsContext();
  const onSubmit = useCallback(
    async (values: typeof apduFormValues) => {
      setLoading(true);
      let rawApduResponse;
      try {
        rawApduResponse = await dmk.sendApdu({
          sessionId: selectedSessionId ?? "",
          apdu: getRawApdu(values),
        });
        setApduResponse(rawApduResponse);
        setLoading(false);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        setLoading(false);
      }
    },
    [getRawApdu, dmk, selectedSessionId],
  );
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
              <FieldName variant="body">Class instruction</FieldName>
              <Input
                name="instructionClass"
                containerProps={inputContainerProps}
                value={apduFormValues.instructionClass}
                onChange={(value) =>
                  setApduFormValue("instructionClass", value)
                }
              />
            </InputContainer>
            <InputContainer>
              <FieldName variant="body">Instruction method</FieldName>
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
              <FieldName variant="body">Parameter 1</FieldName>
              <Input
                name="firstParameter"
                containerProps={inputContainerProps}
                value={apduFormValues.firstParameter}
                onChange={(value) => setApduFormValue("firstParameter", value)}
              />
            </InputContainer>
            <InputContainer>
              <FieldName variant="body">Parameter 2</FieldName>
              <Input
                name="secondParameter"
                containerProps={inputContainerProps}
                value={apduFormValues.secondParameter}
                onChange={(value) => setApduFormValue("secondParameter", value)}
              />
            </InputContainer>
            <InputContainer>
              <FieldName variant="body">Data</FieldName>
              <Input
                name="data"
                placeholder="<NO DATA>"
                containerProps={inputContainerProps}
                value={apduFormValues.data}
                onChange={(value) => setApduFormValue("data", value)}
              />
            </InputContainer>
            <InputContainer>
              <FieldName variant="body">Data length</FieldName>
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
        <Divider mt={4} />
        {apduResponse && (
          <>
            <span>
              <ResultDescText>Raw APDU:</ResultDescText>
              <Text>{getHexString(getRawApdu(apduFormValues))}</Text>
            </span>
            <span>
              <ResultDescText>Response status:</ResultDescText>
              <Text>{getHexString(apduResponse.statusCode)}</Text>
            </span>
            <span>
              <ResultDescText>Response raw data:</ResultDescText>
              <Text>{getHexString(apduResponse.data)}</Text>
            </span>
            <Divider my={4} />
          </>
        )}
        <FormFooter my={8}>
          <FormFooterButton
            onClick={() => onSubmit(apduFormValues)}
            disabled={loading}
          >
            <Text color="neutral.c00">Send APDU</Text>
          </FormFooterButton>
        </FormFooter>
      </FormContainer>
    </Root>
  );
};
