import type { DesktopApi, OpenDocument } from "../../shared/types";

type DiscardConfirmationApi = Pick<DesktopApi, "confirmDiscardChanges">;

export async function confirmDocumentClose(
  document: OpenDocument,
  desktopApi: DiscardConfirmationApi,
  addToast: (message: string, tone: "danger") => void,
): Promise<boolean> {
  if (!document.dirty) return true;
  try {
    return await desktopApi.confirmDiscardChanges(document.path);
  } catch (error) {
    addToast(
      `Could not confirm closing the file: ${error instanceof Error ? error.message : String(error)}`,
      "danger",
    );
    return false;
  }
}
