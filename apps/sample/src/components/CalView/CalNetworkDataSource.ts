export type ApiResponse = {
  responseType: "NotFound" | "eip712" | "ethereum_app_plugins";
  descriptors: Descriptor[];
};

export type Descriptor = {
  display_name: string | undefined;
  field_mappers_count: number;
  method: string | undefined;
};

let endpointUrl = "https://crypto-assets-service.api.ledger-test.com";
let branchName = "main";

export const checkContractAvailability = async (
  contractName: string,
  endpoint: string = "https://crypto-assets-service.api.ledger-test.com",
  branch: string = "main",
): Promise<ApiResponse> => {
  let descriptors: Descriptor[];

  endpointUrl = endpoint;
  branchName = branch;

  let responseType: "NotFound" | "eip712" | "ethereum_app_plugins";

  const pluginResult = await checkPluginAvailability(contractName);
  if (pluginResult.length == 0) {
    const eip712Result = await checkEip712Availability(contractName);

    if (eip712Result.length == 0) {
      responseType = "NotFound";
      descriptors = [];
    } else {
      responseType = "eip712";
      descriptors = eip712Result;
    }
  } else {
    responseType = "ethereum_app_plugins";
    descriptors = pluginResult;
  }

  return {
    responseType: responseType,
    descriptors: descriptors,
  } as ApiResponse;
};

async function checkPluginAvailability(
  contractName: string,
): Promise<Descriptor[]> {
  const output = "descriptors_ethereum_app_plugins";
  const response = await fetchRequest(output, contractName);

  if (response != null) {
    const descriptors: Descriptor[] = [];
    response.forEach((obj) => {
      const contracts = Object.values(obj.descriptors_ethereum_app_plugins!);
      contracts.forEach((element) => {
        Object.values(element.selectors).forEach((selector) => {
          descriptors.push({
            display_name: undefined,
            field_mappers_count: 0,
            method: selector.method,
          } as Descriptor);
        });
      });
    });

    return descriptors;
  } else {
    return [];
  }
}

async function checkEip712Availability(
  contractName: string,
): Promise<Descriptor[]> {
  const output = "descriptors_eip712";
  const response: ResponseDto | null = await fetchRequest(output, contractName);

  if (response != null) {
    const descriptors: Descriptor[] = [];
    response.forEach((obj) => {
      const contracts = Object.values(obj.descriptors_eip712!)
        .map((element) => {
          return Object.values(element);
        })
        .flat();

      contracts.forEach((element) => {
        element.instructions.forEach((instruction) => {
          if (instruction.type === "message") {
            descriptors.push({
              display_name: instruction.display_name,
              field_mappers_count: instruction.field_mappers_count,
              method: undefined,
            });
          }
        });
      });
    });

    console.log(descriptors);
    return descriptors;
  } else {
    return [];
  }
}

type ResponseDto = {
  descriptors_eip712:
    | {
        [key: string]: {
          [key: string]: {
            instructions: {
              display_name: string;
              field_mappers_count: number;
              descriptor: string;
              type: string;
              signatures: {
                prod: string;
                test: string;
              };
            }[];
          };
        };
      }
    | undefined;
  descriptors_ethereum_app_plugins:
    | {
        [key: string]: {
          selectors: {
            method: string;
            signature: string;
            serialized_data: string;
          }[];
        };
      }
    | undefined;
}[];

async function fetchRequest(
  output: string,
  contractName: string,
): Promise<ResponseDto | null> {
  const path = `${endpointUrl}/v1/dapps?ref=branch%3A${branchName}&output=${output}&chain_id=1&contracts=${contractName}`;
  const response = await fetch(path);

  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  if (
    (Array.isArray(body) && body.length === 0) ||
    (body.length === 1 && Object.keys(body[0]).length === 0)
  ) {
    return null;
  }
  return body as ResponseDto;
}
