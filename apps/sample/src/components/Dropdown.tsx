import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

const Container = styled.div`
  position: relative;
`;

const Menu = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  z-index: 1000;
  padding: 4px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
`;

export const DropdownItem = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  row-gap: 2px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:hover {
    background-color: ${({ theme }) => theme.colors.neutral.c30};
  }
`;

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
    <Container ref={containerRef}>
      <div ref={triggerRef} onClick={handleToggle}>
        {trigger}
      </div>
      {isOpen &&
        createPortal(
          <Menu
            ref={menuRef}
            $top={menuPosition.top}
            $left={menuPosition.left}
            onClick={handleMenuClick}
          >
            {children}
          </Menu>,
          document.body,
        )}
    </Container>
  );
};
