import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmDialog } from "../ConfirmDialog";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@/stores/useUIStore", () => {
  const setConfirmDialog = vi.fn((val) => {
    mockStoreState.confirmDialog = val;
  });
  const mockStoreState: {
    confirmDialog: { message: string; onConfirm: () => void } | null;
    setConfirmDialog: typeof setConfirmDialog;
  } = {
    confirmDialog: null,
    setConfirmDialog,
  };

  const useUIStoreMock: any = vi.fn(() => mockStoreState);
  useUIStoreMock.getState = () => mockStoreState;
  useUIStoreMock.setState = (update: Partial<typeof mockStoreState>) => {
    Object.assign(mockStoreState, update);
  };

  return { useUIStore: useUIStoreMock };
});

describe("ConfirmDialog", () => {
  beforeEach(() => {
    useUIStore.setState({ confirmDialog: null });
    vi.clearAllMocks();
  });

  it("renders null when confirmDialog is null", () => {
    const html = renderToStaticMarkup(<ConfirmDialog />);
    expect(html).toBe("");
  });

  it("renders modal message and automatically closes when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    useUIStore.setState({
      confirmDialog: {
        message: "Bạn có chắc chắn muốn xóa biến số này không?",
        onConfirm,
      },
    });

    const html = renderToStaticMarkup(<ConfirmDialog />);
    expect(html).toContain("Bạn có chắc chắn muốn xóa biến số này không?");

    // Verify rendered element buttons
    let captured: React.ReactElement | null = null;
    function Harness() {
      captured = ConfirmDialog() as React.ReactElement | null;
      return captured;
    }
    renderToStaticMarkup(<Harness />);
    expect(captured).not.toBeNull();

    // Confirm button is the second button in footer
    const modalContent = captured!.props.children;
    const body = modalContent.props.children[1];
    const footer = body.props.children[1];
    const [cancelBtn, confirmBtn] = footer.props.children;

    confirmBtn.props.onClick();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().confirmDialog).toBeNull();
  });

  it("closes dialog when cancel button is clicked", () => {
    const onConfirm = vi.fn();
    useUIStore.setState({
      confirmDialog: {
        message: "Hủy thao tác",
        onConfirm,
      },
    });

    let captured: React.ReactElement | null = null;
    function Harness() {
      captured = ConfirmDialog() as React.ReactElement | null;
      return captured;
    }
    renderToStaticMarkup(<Harness />);

    const modalContent = captured!.props.children;
    const body = modalContent.props.children[1];
    const footer = body.props.children[1];
    const [cancelBtn] = footer.props.children;

    cancelBtn.props.onClick();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUIStore.getState().confirmDialog).toBeNull();
  });

  it("closes dialog when close X button or backdrop is clicked", () => {
    useUIStore.setState({
      confirmDialog: {
        message: "Đóng cửa sổ",
        onConfirm: vi.fn(),
      },
    });

    let captured: React.ReactElement | null = null;
    function Harness() {
      captured = ConfirmDialog() as React.ReactElement | null;
      return captured;
    }
    renderToStaticMarkup(<Harness />);

    const backdrop = captured!;
    const modalContent = backdrop.props.children;
    const header = modalContent.props.children[0];
    const closeBtn = header.props.children;

    closeBtn.props.onClick();
    expect(useUIStore.getState().confirmDialog).toBeNull();

    useUIStore.setState({
      confirmDialog: {
        message: "Bấm ra ngoài",
        onConfirm: vi.fn(),
      },
    });

    let captured2: React.ReactElement | null = null;
    function Harness2() {
      captured2 = ConfirmDialog() as React.ReactElement | null;
      return captured2;
    }
    renderToStaticMarkup(<Harness2 />);
    captured2!.props.onClick();
    expect(useUIStore.getState().confirmDialog).toBeNull();
  });
});
