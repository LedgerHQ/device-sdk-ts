import React from "react";
import { Flex, InfiniteLoader, Text, Icons } from "@ledgerhq/react-ui";
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
                <Text ml={2}>
                  Smart Contract of type <b>`{type}`</b> is deployed
                  <br />
                  <a
                    href={`https://etherscan.io/address/${searchAddress}#code`}
                    target="_blank"
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
                  <Text ml={2}>
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
                  <Text ml={2}>
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
                <Text ml={2}>
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

{
  /*
           </>
            ))}

{/  *
          {type === "eip712" &&   (
              <Flex align=  "center">
                  <Text ml={2}>
                  <ul>
                    {Object  .values(data.result).flatMap((item: any) =>
                        item.descriptors_eip712
                        ?   Object.values(item.descriptors_eip712).flatMap(  
                            (descriptor: any) =>
                                Object.values(descriptor).flatMap  (
                                (subItem: any) => {
                                    if (subItem.instructions) {
                                      return subItem.  instructions
                                      .filter(
                                          (instruction: any) =>
                                            instruction.type === "message",
                                      )  
                                      .map((instruction: any) => (
                                          <li key={instruction.display_name}>
                                            - {instruction.display_name} (
                                            {instruction.  field_mappers_count}{" "}
                                            fields)
                                          </  li>
                                      )  );
                                    }
                                    return [];
                                  },  
                                ),
                            )
                                      
            </>
 : [],
               )}
                  </ul>
                </Text>
              </Flex>
             
            </>
          )}
          {type !== "ethereum_app_plugins" && type !== "eip712" && (
            <Flex align="center">
              <Icons.Er style={{ color: "green" }} />
              <Text ml={2}>
                Address not deployed
                <br />
                <a
                  href={`https://etherscan.io/address/${data.smartContractAddress}#code`}
                  target="_blank"
                >
                  {data.smartContractAddress}
                </a>
                <span style={{ color: "lightgray", fontSize: "9px" }}>
                  <br />
                  {
                    //formatDistanceToNow(new Date(data.date), { addSuffix: true })
                    "TEST"
                  }
                </span>
              </Text>
            </Flex>
          )}
        </>
      )}
*/
}
