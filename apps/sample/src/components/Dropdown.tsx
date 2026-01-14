import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

const Container = styled.div`
  position: relative;
`;

const Menu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 220px;
  padding: 4px;
  margin-top: 4px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.neutral.c20};
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleMenuClick = useCallback(() => {
    if (closeOnSelect) {
      setIsOpen(false);
    }
  }, [closeOnSelect]);

  return (
    <Container ref={containerRef}>
      <div onClick={handleToggle}>{trigger}</div>
      {isOpen && <Menu onClick={handleMenuClick}>{children}</Menu>}
    </Container>
  );
};
