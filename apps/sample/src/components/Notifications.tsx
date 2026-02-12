import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearDisplayedError, selectDisplayedError } from "@/state/ui/slice";

import { ErrorNotification } from "./ErrorNotification";

export const Notifications: React.FC = () => {
  const dispatch = useDispatch();
  const displayedError = useSelector(selectDisplayedError);

  const handleDismissError = useCallback(() => {
    dispatch(clearDisplayedError());
  }, [dispatch]);

  if (!displayedError) {
    return null;
  }

  return (
    <ErrorNotification error={displayedError} onDismiss={handleDismissError} />
  );
};
