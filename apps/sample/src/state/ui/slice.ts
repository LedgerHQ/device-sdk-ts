import { type DmkError } from "@ledgerhq/device-management-kit";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type UiState = {
  displayedError: DmkError | null;
};

const initialState: UiState = {
  displayedError: null,
};

export const uiSlice = createSlice({
  name: "ui",
  reducerPath: "ui",
  initialState,
  reducers: {
    setDisplayedError: (state, action: PayloadAction<DmkError | null>) => {
      state.displayedError = action.payload;
    },
    clearDisplayedError: (state) => {
      state.displayedError = null;
    },
  },
});

export const { setDisplayedError, clearDisplayedError } = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

export const selectDisplayedError = (state: { ui: UiState }) =>
  state.ui.displayedError;
