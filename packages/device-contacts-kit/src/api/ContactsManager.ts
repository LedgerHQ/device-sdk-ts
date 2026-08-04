/**
 * Public, stateless Contacts (Address Book) manager.
 *
 * It only drives device interactions — taking caller input, running the device
 * operation, and returning the device output (including proof material). It
 * does not store anything, own the address book, or handle persistence; the
 * host is responsible for that.
 *
 * Concrete management operations (Register Identity, Edit Contact Name, Edit
 * Identifier, Edit Scope, Register Ledger Account, Edit Ledger Account) are
 * added by their dedicated implementation tickets. This interface is
 * intentionally empty until then.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContactsManager {}
