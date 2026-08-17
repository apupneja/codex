import { Composer } from "../../components/Composer";
import { useSession } from "../../state/session";
import { ApprovalCard } from "../approvals/ApprovalCard";
import { McpRequestCard } from "../approvals/McpRequestCard";
import { OptionPickerCard } from "../approvals/OptionPickerCard";
import { PermissionRequestCard } from "../approvals/PermissionRequestCard";
import { SetupContextPickerCard } from "../approvals/SetupContextPickerCard";
import { UserInputCard } from "../approvals/UserInputCard";
import { ThreadTimeline } from "./ThreadTimeline";

export function ThreadPage({
  onContinue,
}: {
  onContinue(turnId: string): void;
}) {
  const { approvals, current, error, submit } = useSession();
  if (!current) return null;
  const approval = approvals.find(
    (item) => String(item.params.threadId ?? "") === current.id,
  );
  const isUserInput = approval?.method === "item/tool/requestUserInput";
  const isPermission = approval?.method === "item/permissions/requestApproval";
  const isOptionPicker = approval?.method === "item/tool/requestOptionPicker";
  const isSetupContextPicker =
    approval?.method === "item/tool/requestSetupCodexContextPicker";
  const isMcpElicitation = approval?.method === "mcpServer/elicitation/request";
  return (
    <main className="thread-page">
      <ThreadTimeline
        onContinue={onContinue}
        onEditMessage={(text) =>
          submit({ attachments: [], effort: "medium", model: "", text })
        }
        askingQuestions={isUserInput}
        requestStatus={isMcpElicitation ? "Awaiting approval" : undefined}
        thread={current}
      />
      {error && <div className="thread-error">{error}</div>}
      {approval ? (
        isUserInput ? (
          <UserInputCard key={approval.id} request={approval} />
        ) : isPermission ? (
          <PermissionRequestCard key={approval.id} request={approval} />
        ) : isOptionPicker ? (
          <OptionPickerCard key={approval.id} request={approval} />
        ) : isSetupContextPicker ? (
          <SetupContextPickerCard key={approval.id} request={approval} />
        ) : isMcpElicitation ? (
          <McpRequestCard key={approval.id} request={approval} />
        ) : (
          <ApprovalCard approval={approval} />
        )
      ) : (
        <Composer />
      )}
    </main>
  );
}
