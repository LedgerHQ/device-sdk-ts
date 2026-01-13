import React from "react";

type State =
  | {
      hasError: true;
      error: Error;
    }
  | {
      hasError: false;
    };

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  override componentDidCatch(error: Error, _info: React.ErrorInfo) {
    this.setState({ hasError: true, error: error });
  }

  reset() {
    this.setState({ hasError: false });
  }

  override render() {
    if (this.state.hasError) {
      console.log("rendering error boundary", this.state.error);
      // You can render any custom fallback UI
      return (
        <div
          style={{ display: "flex", flexDirection: "column", height: "100vh" }}
        >
          <button onClick={() => this.reset()}>Retry</button>
          <pre>{this.state.error.message}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
