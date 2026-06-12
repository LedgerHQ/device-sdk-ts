import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Ephemeral signer-runtime toggles. Lives outside the contacts wallet
 * slice (which mirrors DMK core's `Wallet` shape) so the wallet's
 * persistence round-trip stays clean.
 */
export type SignerRuntimeState = {
  /**
   * QA / firmware-comparison affordance: when true, the
   * `ContactsDataSource` adapter short-circuits both lookups to `null`,
   * so the next `signTransaction` runs the un-decorated path. Lets a
   * reviewer eyeball the device output with and without contacts
   * metadata side by side without re-wiring the SDK.
   */
  contactsAutoDecorationDisabled: boolean;
};

const initialState: SignerRuntimeState = {
  contactsAutoDecorationDisabled: false,
};

export const signerRuntimeSlice = createSlice({
  name: "signerRuntime",
  reducerPath: "signerRuntime",
  initialState,
  reducers: {
    setContactsAutoDecorationDisabled: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.contactsAutoDecorationDisabled = action.payload;
    },
  },
});

export const { setContactsAutoDecorationDisabled } = signerRuntimeSlice.actions;

export const signerRuntimeReducer = signerRuntimeSlice.reducer;
