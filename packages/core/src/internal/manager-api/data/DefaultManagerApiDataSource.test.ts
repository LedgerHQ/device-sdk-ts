import { MANAGER_API_BASE_URL } from "@internal/manager-api//model/Const";

import { DefaultManagerApiDataSource } from "./DefaultManagerApiDataSource";

describe("DefaultManagerApiDataSource", () => {
  it("fetch data", async () => {
    const api = new DefaultManagerApiDataSource({
      managerApiUrl: MANAGER_API_BASE_URL,
    });

    // appFullHash from the ListApps/ListAppsContinue command's response
    const hashes = [
      "c7507c742ce3f8ec446b1ebda18159a5d432241a7199c3fc2401e72adfa9ab38",
    ];

    const apps = await api.getAppsByHash(hashes);
    console.log(apps);

    expect(apps).toHaveLength(1);
  });

  // TODO: finish testing
});
