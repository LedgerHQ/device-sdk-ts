import React from "react";
import { Divider } from "@ledgerhq/lumen-ui-react";
import { ChevronRight } from "@ledgerhq/lumen-ui-react/symbols";

type Segment = { label: string; value: string };

type Props = {
  children: React.ReactNode;
} & (
  | { title: string }
  | { segments: Segment[]; onChange: (values: string[]) => void }
);

export const PageWithHeader: React.FC<Props> = (props) => {
  const { children } = props;
  const segments: Segment[] =
    "title" in props
      ? [{ label: props.title, value: props.title }]
      : props.segments;
  const onChange = "title" in props ? undefined : props.onChange;

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-24">
      <div className="flex size-full flex-col overflow-hidden">
        <nav className="flex flex-row items-center gap-8 pt-40">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <React.Fragment key={segment.value}>
                {index > 0 && <ChevronRight size={16} className="text-muted" />}
                <span
                  className={
                    isLast
                      ? "heading-5-semi-bold text-base"
                      : "heading-5-semi-bold cursor-pointer text-muted hover:text-base"
                  }
                  onClick={
                    isLast
                      ? undefined
                      : () =>
                          onChange?.(
                            segments.slice(0, index + 1).map((s) => s.value),
                          )
                  }
                >
                  {segment.label}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
        <Divider className="my-16" />
        {children}
      </div>
    </div>
  );
};
