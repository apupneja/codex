import type {
  BrowserWindow,
  MessageBoxOptions,
  MessageBoxReturnValue,
} from "electron";

export type MessageBoxPresenter = {
  showMessageBox(
    window: BrowserWindow,
    options: MessageBoxOptions,
  ): Promise<MessageBoxReturnValue>;
};

type ConfirmDiscardChangesOptions = {
  cancelLabel: string;
  detail: string;
  iconPath: string;
};

export async function confirmDiscardChanges(
  presenter: MessageBoxPresenter,
  window: BrowserWindow,
  options: ConfirmDiscardChangesOptions,
): Promise<boolean> {
  const result = await presenter.showMessageBox(window, {
    buttons: [options.cancelLabel, "Discard Changes"],
    cancelId: 0,
    defaultId: 0,
    detail: options.detail,
    icon: options.iconPath,
    message: "Discard unsaved changes?",
    noLink: true,
    type: "none",
  });
  return result.response === 1;
}
