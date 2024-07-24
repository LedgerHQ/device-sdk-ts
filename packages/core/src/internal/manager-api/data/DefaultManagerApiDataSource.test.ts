import { MANAGER_API_BASE_URL } from "@internal/manager-api//model/Const";

import { DefaultManagerApiDataSource } from "./DefaultManagerApiDataSource";

describe("DefaultManagerApiDataSource", () => {
  it("fetch data", async () => {
    const api = new DefaultManagerApiDataSource({
      managerApiUrl: MANAGER_API_BASE_URL,
    });

    // appFullHash from the ListApps/ListAppsContinue command's response
    const hashes = [
      "81e73bd232ef9b26c00a152cb291388fb3ded1a2db6b44f53b3119d91d2879bb",
    ];

    const apps = await api.getAppsByHash(hashes);
    // console.log(apps);

    expect(apps).toHaveLength(1);
  });
});
