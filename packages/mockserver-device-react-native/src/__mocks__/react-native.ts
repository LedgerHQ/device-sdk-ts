/**
 * React Native as react-test-renderer sees it: host components that keep
 * their props, so a test reads styles and calls handlers directly.
 */
import React from "react";

export const View = "View";
export const Text = "Text";
export const Image = "Image";
export const ScrollView = "ScrollView";
export const ActivityIndicator = "ActivityIndicator";

type Style = Record<string, unknown> | Style[] | undefined;

type PressableProps = {
  style?: Style | ((state: { pressed: boolean }) => Style);
  children?:
    | React.ReactNode
    | ((state: { pressed: boolean }) => React.ReactNode);
};

/** Drawn released: the style and children it would show at rest. */
export const Pressable: React.FC<PressableProps> = ({
  style,
  children,
  ...props
}) =>
  React.createElement(
    "Pressable",
    {
      ...props,
      style: typeof style === "function" ? style({ pressed: false }) : style,
    },
    typeof children === "function" ? children({ pressed: false }) : children,
  );

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};

export const AppState: { currentState: string } = { currentState: "active" };

export const colorScheme: { current: "light" | "dark" | null } = {
  current: null,
};

export const useColorScheme = () => colorScheme.current;
