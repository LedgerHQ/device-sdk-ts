import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@ledgerhq/lumen-ui-react";

import { MOCK_PRESETS, type MockPreset } from "@/domain/mockPresets";

interface MockPresetsDialogProps {
  readonly onPick: (preset: MockPreset) => void;
  readonly onClose: () => void;
}

export function MockPresetsDialog({ onPick, onClose }: MockPresetsDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader
          title="Common scenarios"
          description="Ready-made mocks for the failures apps most often need to handle."
          onClose={onClose}
        />
        <DialogBody scrollbarWidth="auto">
          <div className="border-muted overflow-hidden rounded-md border">
            {MOCK_PRESETS.map((preset) => (
              <div
                key={preset.label}
                className="border-muted flex items-center gap-12 border-b px-12 py-8 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="body-3 text-base">{preset.label}</span>
                  <span className="body-4 text-muted-subtle">
                    {preset.description}
                  </span>
                  <span className="body-4 text-muted font-mono">
                    {`${preset.prefix} → ${preset.responses.join(", ")}`}
                  </span>
                </span>
                <Button
                  appearance="gray"
                  size="sm"
                  onClick={() => onPick(preset)}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
