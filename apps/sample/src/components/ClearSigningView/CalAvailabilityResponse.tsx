import React from "react";
import { Spinner } from "@ledgerhq/lumen-ui-react";
import { CheckmarkCircle, Warning } from "@ledgerhq/lumen-ui-react/symbols";

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
        <Spinner size={20} />
      ) : (
        <>
          {(type === "ethereum_app_plugins" || type === "eip712") && (
            <>
              <div className="flex flex-col">
                <div className="flex items-center">
                  <CheckmarkCircle size={24} className="text-success" />
                  <span className="body-1" style={{ margin: "6px" }}>
                    Smart Contract of type{" "}
                    <span style={{ fontWeight: "bold" }}>`{type}`</span> is
                    deployed
                  </span>
                </div>
                <div>
                  <span className="body-2">
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
                  </span>
                </div>
                <div>
                  <span className="body-2">
                    <span style={{ color: "lightgray", fontSize: "9px" }}>
                      {"Checked at : " + formattedDate}
                    </span>
                  </span>
                </div>
              </div>
              {type === "ethereum_app_plugins" && (
                <div>
                  <span className="body-2">
                    <ul>
                      {descriptors.map((descriptor: Descriptor) => {
                        return (
                          <li key={descriptor.method}>- {descriptor.method}</li>
                        );
                      })}
                    </ul>
                  </span>
                </div>
              )}
              {type === "eip712" && (
                <div>
                  <span className="body-2">
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
                  </span>
                </div>
              )}
            </>
          )}
          {type !== "ethereum_app_plugins" && type !== "eip712" && (
            <>
              <div className="flex items-center">
                <Warning size={24} className="text-error" />
                <span className="body-1" style={{ marginLeft: "6px" }}>
                  Smart Contract is unknown
                </span>
              </div>
              <div>
                <span className="body-2">
                  <span style={{ fontSize: "14px" }}>
                    Make sure the address : <b>{searchAddress}</b> is right.
                  </span>
                </span>
              </div>
              <div>
                <span className="body-2">
                  <span style={{ color: "lightgray", fontSize: "9px" }}>
                    {"Checked at : " + formattedDate}
                  </span>
                </span>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
