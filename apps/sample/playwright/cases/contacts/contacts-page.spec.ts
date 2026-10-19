/* eslint-disable no-restricted-imports */
import { expect, test } from "../../fixtures";

// The page's local flows (add / rename / delete, validation, persistence) and
// the device step's no-device state. Device operations themselves are covered
// by the manual matrix in docs/contacts-validation.md.

const BOB_SOLANA = "7J922pfkw6Kz1TtEpr5jvBJEV9k2wbBG4L981r1NBPpu";
// Another valid 32-byte Solana key (the System Program id).
const OTHER_SOLANA = "11111111111111111111111111111111";

test.describe("contacts page", () => {
  test.beforeEach(async ({ contacts }) => {
    await contacts.open();
  });

  test("adds a local contact without a device", async ({ page, contacts }) => {
    await test.step("When a contact is added", async () => {
      await contacts.addContact("Dana R.");
    });

    await test.step("Then it is listed and selected, with no address yet", async () => {
      await expect(contacts.row("Dana R.")).toContainText("0 address");
      await expect(page.getByTestId("contacts-detail-name")).toHaveText(
        "Dana R.",
      );
      await expect(
        page.getByTestId("contacts-detail-empty-state"),
      ).toContainText("No saved addresses for Dana R.");
    });

    await test.step("And it survives a reload", async () => {
      await page.reload();
      await expect(contacts.row("Dana R.")).toBeVisible();
    });
  });

  test("validates the contact name", async ({ contacts }) => {
    await contacts.loadSamples();
    await contacts.openAddContact();
    const submit = contacts.dialog.getByRole("button", { name: "Add contact" });

    await contacts.fillContactName("Zoë");
    await expect(contacts.dialog).toContainText(
      "Special characters are not allowed.",
    );
    await expect(submit).toBeDisabled();

    await contacts.fillContactName("alice (sample)");
    await expect(contacts.dialog).toContainText(
      "This contact name is already in use.",
    );
    await expect(submit).toBeDisabled();

    await contacts.fillContactName("Carol");
    await expect(submit).toBeEnabled();
  });

  test("searches contacts by name", async ({ page, contacts }) => {
    await contacts.loadSamples();

    await contacts.search("bob");
    await expect(contacts.row("Bob (sample)")).toBeVisible();
    await expect(contacts.row("Alice (sample)")).toBeHidden();

    await contacts.search("nobody");
    await expect(page.getByTestId("contacts-search-no-results")).toContainText(
      "No contact found",
    );
  });

  test("renames a local contact without a device", async ({ contacts }) => {
    await contacts.addContact("Dana R.");
    await contacts.openEditContact();
    await contacts.fillContactName("Dana S.");
    await contacts.dialog
      .getByRole("button", { name: "Apply changes" })
      .click();
    await expect(contacts.row("Dana S.")).toBeVisible();
  });

  test("checks a Solana address before the device step", async ({
    page,
    contacts,
  }) => {
    await contacts.loadSamples();
    await contacts.addContact("Dana R.");
    await contacts.startAddAddress("solana");
    const submit = contacts.dialog.getByTestId("contacts-add-address-submit");

    await test.step("A malformed address is refused", async () => {
      await contacts.fillAddress("not-a-solana-address", "Dana main");
      await expect(contacts.dialog).toContainText("Incorrect address format.");
      await expect(submit).toBeDisabled();
    });

    await test.step("An address saved for another contact is refused", async () => {
      await contacts.fillAddress(BOB_SOLANA);
      await expect(contacts.dialog).toContainText(
        "This address is already used for Bob (sample).",
      );
    });

    await test.step("A valid address passes, with the Solana support note", async () => {
      await contacts.fillAddress(OTHER_SOLANA);
      await expect(contacts.dialog).toContainText("Valid address");
      await expect(
        contacts.dialog.getByTestId("contacts-family-availability-note"),
      ).toBeVisible();
      await expect(submit).toBeEnabled();
    });

    await test.step("Without a device, the device step asks for one", async () => {
      await submit.click();
      await expect(page.getByTestId("contacts-device-state")).toHaveAttribute(
        "data-state",
        "no-device",
      );
      await expect(contacts.dialog).toContainText("Ledger device required");
    });
  });

  test("checks EVM and Tron address formats", async ({ contacts }) => {
    await contacts.addContact("Dana R.");

    await contacts.startAddAddress("polygon");
    await contacts.fillAddress("0x1234");
    await expect(contacts.dialog).toContainText("Incorrect address format.");
    await contacts.fillAddress("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
    await expect(contacts.dialog).toContainText("Valid address");
    await contacts.dialog.getByRole("button", { name: "Close" }).click();

    await contacts.startAddAddress("tron");
    await contacts.fillAddress("TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU8");
    await expect(contacts.dialog).toContainText("Incorrect address format.");
    await contacts.fillAddress("TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7");
    await expect(contacts.dialog).toContainText("Valid address");
  });

  test("deletes an address, then the contact", async ({ page, contacts }) => {
    await contacts.loadSamples();
    await contacts.selectContact("Bob (sample)");

    await contacts.openAddressDetail("Sol main");
    await expect(
      page.getByTestId("contacts-address-detail-full-address"),
    ).toHaveText(BOB_SOLANA);
    await page.getByTestId("contacts-address-detail-delete").click();
    await contacts.confirmDelete();
    await expect(contacts.row("Bob (sample)")).toContainText("1 address");

    await page.getByTestId("contacts-detail-delete").click();
    await contacts.confirmDelete();
    await expect(contacts.row("Bob (sample)")).toBeHidden();
  });
});
