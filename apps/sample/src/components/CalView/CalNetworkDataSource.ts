export type ApiResponse = {
  responseType: "NotFound" | "eip712" | "ethereum_app_plugins";
  descriptors: Descriptor[];
};

export type Descriptor = {
  display_name: string | undefined;
  field_mappers_count: number;
  method: string | undefined;
};

export const checkContractAvailability = async (
  contractName: string,
  endpoint: string,
  branch: string,
): Promise<ApiResponse> => {
  let descriptors: Descriptor[];
  let responseType: "NotFound" | "eip712" | "ethereum_app_plugins";

  const pluginResult = await checkPluginAvailability(
    contractName,
    endpoint,
    branch,
  );
  if (pluginResult.length == 0) {
    const eip712Result = await checkEip712Availability(
      contractName,
      endpoint,
      branch,
    );

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
  endpoint: string,
  branch: string,
): Promise<Descriptor[]> {
  const output = "descriptors_ethereum_app_plugins";
  const response = await fetchRequest(output, contractName, endpoint, branch);

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
  endpoint: string,
  branch: string,
): Promise<Descriptor[]> {
  const output = "descriptors_eip712";
  const response: ResponseDto | null = await fetchRequest(
    output,
    contractName,
    endpoint,
    branch,
  );

  if (response != null) {
    const descriptors: Descriptor[] = [];
    response.forEach((obj) => {
      const contracts = Object.values(obj.descriptors_eip712![contractName as keyof typeof obj.descriptors_eip712]!);

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
  endpoint: string,
  branch: string,
): Promise<ResponseDto | null> {
  const path = `${endpoint}/dapps?ref=branch%3A${branch}&output=${output}&chain_id=1&contracts=${contractName}`;
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
