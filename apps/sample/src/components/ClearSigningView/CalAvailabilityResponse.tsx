import React from "react";
import { Box, Flex, Icons, InfiniteLoader, Text } from "@ledgerhq/react-ui";

import { type Descriptor } from "./CalNetworkDataSource";

type CalAvailabilityResponseProps = {
  loading: boolean;
  type: string;
  date: Date;
  descriptors: Descriptor[];
  searchAddress: string;
};

export function CalAvailabilityResponseComponent(
  props: CalAvailabilityResponseProps,
) {
  const { type, loading, descriptors, searchAddress } = props;
  const formattedDate = props.date.toLocaleTimeString("en-US", {
    hour12: false,
  });

  return (
    <>
      {loading ? (
        <InfiniteLoader size={20} />
      ) : (
        <>
          {(type === "ethereum_app_plugins" || type === "eip712") && (
            <>
              <Flex flexDirection="column">
                <Flex alignItems="center">
                  <Icons.CheckmarkCircle style={{ color: "green" }} />
                  <Text
                    variant="large"
                    fontWeight="regular"
                    style={{ margin: "6px" }}
                  >
                    Smart Contract of type{" "}
                    <span style={{ fontWeight: "bold" }}>`{type}`</span> is
                    deployed
                  </Text>
                </Flex>
                <Box>
                  <Text>
                    <span style={{ fontSize: "14px" }}>
                      <a
                        href={`https://etherscan.io/address/${searchAddress}#code`}
                        style={{
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        {searchAddress}
                      </a>
                    </span>
                  </Text>
                </Box>
                <Box>
                  <Text>
                    <span style={{ color: "lightgray", fontSize: "9px" }}>
                      {"Checked at : " + formattedDate}
                    </span>
                  </Text>
                </Box>
              </Flex>
              {type === "ethereum_app_plugins" && (
                <Flex>
                  <Text>
                    <ul>
                      {descriptors.map((descriptor: Descriptor) => {
                        return (
                          <li key={descriptor.method}>- {descriptor.method}</li>
                        );
                      })}
                    </ul>
                  </Text>
                </Flex>
              )}
              {type === "eip712" && (
                <Flex>
                  <Text>
                    <ul>
                      {descriptors.map((descriptor: Descriptor) => {
                        return (
                          <li key={descriptor.display_name}>
                            - {descriptor.display_name} (
                            {descriptor.field_mappers_count} fields)
                          </li>
                        );
                      })}
                    </ul>
                  </Text>
                </Flex>
              )}
            </>
          )}
          {type !== "ethereum_app_plugins" && type !== "eip712" && (
            <>
              <Flex alignItems="center">
                <Icons.Warning style={{ color: "red" }} />
                <Text
                  variant="large"
                  fontWeight="regular"
                  style={{ marginLeft: "6px" }}
                >
                  Smart Contract is unknown
                </Text>
              </Flex>
              <Box>
                <Text>
                  <span style={{ fontSize: "14px" }}>
                    Make sure the address : <b>{searchAddress}</b> is right.
                  </span>
                </Text>
              </Box>
              <Box>
                <Text>
                  <span style={{ color: "lightgray", fontSize: "9px" }}>
                    {"Checked at : " + formattedDate}
                  </span>
                </Text>
              </Box>
            </>
          )}
        </>
      )}
    </>
  );
}
