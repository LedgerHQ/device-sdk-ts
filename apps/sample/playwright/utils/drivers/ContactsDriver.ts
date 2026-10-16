import { expect, type Locator, type Page } from "@playwright/test";

const CONTACTS_URL = "http://localhost:3000/contacts";

/**
 * Drives the Ledger Wallet-like Contacts page: the contact list, the selected
 * contact's detail, and the dialogs opened from them. The address book lives
 * in localStorage, so every test starts from an empty book.
 */
export class ContactsDriver {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto(CONTACTS_URL);
    await expect(this.page.getByTestId("contacts-page")).toBeVisible();
  }

  get dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  row(contactName: string): Locator {
    return this.page.getByTestId(`contacts-row-${contactName}`);
  }

  async loadSamples(): Promise<void> {
    await this.page.getByRole("button", { name: "Load samples" }).click();
  }

  async search(query: string): Promise<void> {
    await this.page
      .getByRole("textbox", { name: "Search by name" })
      .fill(query);
  }

  async openAddContact(): Promise<void> {
    await this.page.getByTestId("contacts-add-contact-header").click();
    await expect(this.dialog).toBeVisible();
  }

  async fillContactName(name: string): Promise<void> {
    await this.dialog.getByRole("textbox", { name: "Contact name" }).fill(name);
  }

  async addContact(name: string): Promise<void> {
    await this.openAddContact();
    await this.fillContactName(name);
    await this.dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(this.dialog).toBeHidden();
  }

  async selectContact(contactName: string): Promise<void> {
    await this.row(contactName).click();
    await expect(this.page.getByTestId("contacts-detail-name")).toHaveText(
      contactName,
    );
  }

  async openEditContact(): Promise<void> {
    await this.page.getByTestId("contacts-detail-edit").click();
    await expect(this.dialog).toBeVisible();
  }

  /** Open Add address on the selected contact and pick a network. */
  async startAddAddress(networkId: string): Promise<void> {
    await this.page.getByTestId("contacts-detail-add-address").click();
    await this.dialog.getByTestId(`contacts-network-${networkId}`).click();
    await expect(
      this.dialog.getByRole("heading", { name: "Enter address" }),
    ).toBeVisible();
  }

  async fillAddress(address: string, name?: string): Promise<void> {
    await this.dialog.getByRole("textbox").first().fill(address);
    if (name !== undefined) {
      await this.dialog
        .getByRole("textbox", { name: "Address name" })
        .fill(name);
    }
  }

  async openAddressDetail(addressName: string): Promise<void> {
    await this.page.getByTestId(`contacts-address-row-${addressName}`).click();
    await expect(
      this.page.getByTestId("contacts-address-detail-dialog"),
    ).toBeVisible();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByTestId("contacts-confirm-delete").click();
    await expect(this.dialog).toBeHidden();
  }
}
