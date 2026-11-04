import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { ThemeProvider } from "@ledgerhq/lumen-ui-react";

export const DropdownItem: React.FC<React.ComponentProps<"button">> = ({
  className,
  ...props
}) => (
  <button
    className={cn(
      "flex w-full cursor-pointer flex-col items-start gap-2 rounded-sm border-0 bg-transparent px-12 py-8 text-left hover:bg-surface-hover",
      className,
    )}
    {...props}
  />
);

type DropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  closeOnSelect?: boolean;
};

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  closeOnSelect = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target) ?? false;
      const isInsideMenu = menuRef.current?.contains(target) ?? false;

      if (!isInsideContainer && !isInsideMenu) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setIsOpen((prev) => !prev);
  }, [isOpen]);

  const handleMenuClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (closeOnSelect) {
        setIsOpen(false);
      }
    },
    [closeOnSelect],
  );

  return (
    <div className="relative" ref={containerRef}>
      <div ref={triggerRef} onClick={handleToggle}>
        {trigger}
      </div>
      {isOpen &&
        createPortal(
          <ThemeProvider colorScheme="dark">
            <div
              ref={menuRef}
              className="fixed z-[1000] rounded-md border border-muted-subtle bg-canvas-sheet p-4 whitespace-nowrap shadow-lg"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              onClick={handleMenuClick}
            >
              {children}
            </div>
          </ThemeProvider>,
          document.body,
        )}
    </div>
  );
};
