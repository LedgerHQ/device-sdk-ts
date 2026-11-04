import React from "react";
import { Banner, Button } from "@ledgerhq/lumen-ui-react";

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
      return (
        <div className="flex h-screen flex-col gap-16 overflow-auto bg-canvas p-24 text-base">
          <Banner
            appearance="error"
            title="The DevTools crashed"
            description={this.state.error.message}
            primaryAction={
              <Button
                appearance="transparent"
                size="sm"
                onClick={() => this.reset()}
              >
                Retry
              </Button>
            }
          />
          <pre className="overflow-auto rounded-md bg-muted p-16 font-mono! body-3 text-muted">
            {this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
