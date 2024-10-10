import React from "react";
import { Flex, Icons, InfiniteLoader, Text } from "@ledgerhq/react-ui";

import { Descriptor } from "./CalNetworkDataSource";

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
              <Flex align="center">
                <Icons.CheckmarkCircle style={{ color: "green" }} />
                <Text>
                  Smart Contract of type <b>`{type}`</b> is deployed
                  <br />
                  <a
                    href={`https://etherscan.io/address/${searchAddress}#code`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {searchAddress}
                  </a>
                  <span style={{ color: "lightgray", fontSize: "9px" }}>
                    <br />
                    {"Checked at : " + formattedDate}
                  </span>
                </Text>
              </Flex>
              {type === "ethereum_app_plugins" && (
                <Flex align="center">
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
                <Flex align="center">
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
              <Flex align="center">
                <Icons.Warning style={{ color: "red" }} />
                <Text>
                  Smart Contract with address : <b>{searchAddress}</b> is
                  unknown
                  <span style={{ color: "lightgray", fontSize: "9px" }}>
                    <br />
                    {"Checked at : " + formattedDate}
                  </span>
                </Text>
              </Flex>
            </>
          )}
        </>
      )}
    </>
  );
}
