import { LoaderCircle, LogIn } from "lucide-react";

type AuthenticationNoticeProps = {
  pending: boolean;
  onSignIn(): void;
};

export function AuthenticationNotice({
  pending,
  onSignIn,
}: AuthenticationNoticeProps) {
  return (
    <div className="authentication-notice" role="status">
      <LogIn aria-hidden="true" size={16} />
      <div>
        <strong>Sign in to use Codex</strong>
        <span>Connect ChatGPT before sending a message.</span>
      </div>
      <button className="button-primary" onClick={onSignIn} type="button">
        {pending ? <LoaderCircle className="spin" size={13} /> : null}
        {pending ? "Open browser again" : "Sign in"}
      </button>
    </div>
  );
}
