import { Info } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { type Approval, useSession } from "../../state/session";
import { permissionDetails, type PermissionDetail } from "./permission-request";

function PermissionHandIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M12.6683 4.16699C12.6683 3.84391 12.4065 3.58203 12.0834 3.58203C11.7603 3.58203 11.4984 3.84391 11.4984 4.16699V7.91699L11.4847 8.05078C11.4227 8.35375 11.1547 8.58203 10.8334 8.58203C10.4662 8.58203 10.1685 8.28411 10.1683 7.91699V3.75C10.1683 3.42691 9.90646 3.16504 9.58337 3.16504C9.26029 3.16504 8.99841 3.42691 8.99841 3.75V7.91699C8.99824 8.28411 8.70053 8.58203 8.33337 8.58203C7.96621 8.58203 7.66851 8.28411 7.66833 7.91699V5C7.66833 4.67691 7.40646 4.41504 7.08337 4.41504C6.76029 4.41504 6.49841 4.67691 6.49841 5V9.30371C6.53326 9.3429 6.56715 9.38359 6.59998 9.42578L8.02478 11.2588C8.25005 11.5486 8.19821 11.9659 7.90857 12.1914C7.6187 12.4169 7.20048 12.365 6.97498 12.0752L5.55017 10.2432C5.15812 9.7391 4.41813 9.73637 4.01501 10.1924C4.04396 10.426 4.11486 10.8323 4.25525 11.3486C4.44664 12.0525 4.75404 12.9113 5.21619 13.7383C6.14103 15.3931 7.62465 16.835 10.0004 16.835C12.8545 16.8348 15.1682 14.5211 15.1683 11.667V6.25C15.1683 5.92691 14.9065 5.66504 14.5834 5.66504C14.2603 5.66504 13.9984 5.92691 13.9984 6.25V9.16699C13.9982 9.53411 13.7005 9.83203 13.3334 9.83203C12.9662 9.83203 12.6685 9.53411 12.6683 9.16699V4.16699ZM13.9984 4.42578C14.1828 4.36671 14.3794 4.33496 14.5834 4.33496C15.641 4.33496 16.4984 5.19237 16.4984 6.25V11.667C16.4982 15.2557 13.589 18.1649 10.0004 18.165C6.95953 18.165 5.10939 16.2734 4.05505 14.3867C3.52774 13.4431 3.1843 12.4787 2.97205 11.6982C2.76447 10.9349 2.66834 10.2954 2.66833 10C2.66833 9.87959 2.70117 9.76148 2.76306 9.6582C3.28988 8.78018 4.26555 8.40372 5.16833 8.56152V5C5.16833 3.94237 6.02575 3.08496 7.08337 3.08496C7.31706 3.08496 7.54039 3.12845 7.74744 3.20508C7.98218 2.41297 8.7151 1.83496 9.58337 1.83496C10.1836 1.83496 10.7186 2.11176 11.0697 2.54395C11.3639 2.35978 11.7107 2.25195 12.0834 2.25195C13.141 2.25195 13.9984 3.10937 13.9984 4.16699V4.42578Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ApprovalChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 21">
      <path
        d="M15.2793 7.71101C15.539 7.45131 15.961 7.45131 16.2207 7.71101C16.4804 7.97071 16.4804 8.39272 16.2207 8.65242L10.4707 14.4024C10.211 14.6621 9.78902 14.6621 9.52932 14.4024L3.77932 8.65242L3.69436 8.54792C3.52385 8.28979 3.55205 7.93828 3.77932 7.71101C4.00659 7.48374 4.3581 7.45554 4.61623 7.62605L4.72073 7.71101L10 12.9903L15.2793 7.71101Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
      />
    </svg>
  );
}

function naturalJoin(values: ReactNode[]): ReactNode {
  return values.map((value, index) => (
    <Fragment key={index}>
      {index > 0
        ? index === values.length - 1
          ? values.length === 2
            ? " and "
            : ", and "
          : ", "
        : null}
      {value}
    </Fragment>
  ));
}

function PathList({
  paths,
}: Extract<PermissionDetail, { kind: "fileSystem" }>) {
  return naturalJoin(
    paths.map((path) => (
      <span className="permission-path" key={path.value} title={path.value}>
        <span className="permission-path__icon">
          <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
            <path
              d="M16.6182 9.33203H3.38184V12.7002C3.38184 13.3753 3.38238 13.8438 3.41211 14.208C3.44124 14.5646 3.49494 14.766 3.57129 14.916L3.63867 15.0361C3.80618 15.3094 4.04683 15.5324 4.33399 15.6787L4.45703 15.7314C4.59362 15.7803 4.77411 15.816 5.04199 15.8379C5.40624 15.8676 5.87469 15.8682 6.54981 15.8682H13.4502C14.1253 15.8682 14.5938 15.8676 14.958 15.8379C15.3146 15.8088 15.516 15.7551 15.666 15.6787L15.7861 15.6113C16.0594 15.4438 16.2824 15.2032 16.4287 14.916L16.4814 14.793C16.5303 14.6564 16.566 14.4759 16.5879 14.208C16.6176 13.8438 16.6182 13.3753 16.6182 12.7002V9.33203ZM17.8818 12.7002C17.8818 13.3547 17.8826 13.8838 17.8477 14.3115C17.8165 14.6922 17.7543 15.0349 17.6172 15.3545L17.5537 15.4902C17.3015 15.9852 16.9182 16.3996 16.4473 16.6885L16.2402 16.8037C15.8824 16.9861 15.4966 17.0621 15.0615 17.0977C14.6338 17.1326 14.1047 17.1318 13.4502 17.1318H6.54981C5.89526 17.1318 5.36616 17.1326 4.93848 17.0977C4.55777 17.0665 4.21506 16.8672 3.89551 16.8672L3.75977 16.8037C3.26483 16.5515 2.85036 16.1682 2.56152 15.6973L2.44629 15.4902C2.26394 15.1324 2.1879 14.7466 2.15235 14.3115C2.1174 13.8838 2.11817 13.3547 2.11817 12.7002V7.29981C2.11817 6.64526 2.1174 6.11616 2.15235 5.68848C2.1879 5.25344 2.26394 4.86765 2.44629 4.50977L2.56152 4.30274C2.85036 3.83179 3.26483 3.44854 3.75977 3.19629L3.89551 3.13281C4.21506 2.99571 4.55777 2.93346 4.93848 2.90235C5.36616 2.8674 5.89526 2.86817 6.54981 2.86817H7.24512C7.38876 2.86816 7.48717 2.86807 7.58399 2.87402L7.83496 2.90039C8.41501 2.98537 8.96006 3.23832 9.40039 3.63086L9.64356 3.86817C9.75546 3.98103 9.79343 4.0181 9.83008 4.05078L9.94238 4.14356C10.2142 4.34787 10.5413 4.46917 10.8828 4.49024L11.1445 4.49317H13.4502C14.1047 4.49317 14.6338 4.4924 15.0615 4.52735C15.4966 4.5629 15.8824 4.63894 16.2402 4.82129L16.4473 4.93652C16.9182 5.22536 17.3015 5.63983 17.5537 6.13477L17.6172 6.27051C17.7543 6.59006 17.8165 6.93277 17.8477 7.31348C17.8826 7.74116 17.8818 8.27026 17.8818 8.92481V12.7002ZM3.38184 8.06836H16.6143C16.6105 7.81516 16.603 7.60256 16.5879 7.41699C16.566 7.14911 16.5303 6.96862 16.4814 6.83203L16.4287 6.70899C16.2824 6.42183 16.0594 6.18118 15.7861 6.01367L15.666 5.94629C15.516 5.86994 15.3146 5.81624 14.958 5.78711C14.5938 5.75738 14.1253 5.75684 13.4502 5.75684H11.1445L10.8047 5.75098C10.2158 5.71466 9.65236 5.50645 9.1836 5.1543L8.98926 4.99414C8.91673 4.92948 8.84746 4.85908 8.7461 4.75684L8.55957 4.57422C8.30416 4.34653 7.98784 4.19959 7.65137 4.15039L7.50684 4.13477C7.45779 4.13174 7.4043 4.13184 7.24512 4.13184H6.54981C5.87469 4.13184 5.40624 4.13238 5.04199 4.16211C4.77411 4.184 4.59362 4.21966 4.45703 4.26856L4.33399 4.32129C4.04683 4.4676 3.80618 4.69061 3.63867 4.96387L3.57129 5.08399C3.49494 5.23405 3.44124 5.43543 3.41211 5.79199C3.38238 6.15624 3.38184 6.62469 3.38184 7.29981V8.06836Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>{path.label}</span>
      </span>
    )),
  );
}

function detailAction(detail: PermissionDetail): ReactNode {
  if (detail.kind === "network") return "connect to the internet";
  const paths = <PathList {...detail} />;
  if (detail.access === "read") return <>view the contents of {paths}</>;
  if (detail.access === "write") return <>edit the contents of {paths}</>;
  return <>view and edit the contents of {paths}</>;
}

function permissionTitle(details: PermissionDetail[]): ReactNode {
  const detail = details.length === 1 ? details[0] : null;
  if (detail?.kind === "network") {
    return "Allow ChatGPT to connect to the internet?";
  }
  if (detail?.kind === "fileSystem") {
    return <>Allow ChatGPT to {detailAction(detail)}?</>;
  }
  return <>Allow ChatGPT to {naturalJoin(details.map(detailAction))}?</>;
}

export function PermissionRequestCard({ request }: { request: Approval }) {
  const { resolvePermissionRequest } = useSession();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const details = permissionDetails(request.params.permissions);
  const networkOnly = details.length === 1 && details[0]?.kind === "network";
  const reason =
    typeof request.params.reason === "string"
      ? request.params.reason.trim()
      : "";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolvePermissionRequest(request, null);
      } else if (event.key === "Enter" && !optionsOpen) {
        event.preventDefault();
        resolvePermissionRequest(request, "turn");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [optionsOpen, request, resolvePermissionRequest]);

  const answer = (scope: "session" | "turn" | null) => {
    setOptionsOpen(false);
    resolvePermissionRequest(request, scope);
  };

  return (
    <div className="approval-request-region">
      <section
        className="approval-request-card approval-request-card--permission"
        data-codex-approval-surface="true"
      >
        <header className="approval-request-card__header">
          <div className="approval-request-card__identity">
            <PermissionHandIcon />
            <span>{networkOnly ? "Internet access" : "Permissions"}</span>
          </div>
          <div className="approval-request-card__title">
            <h2>{permissionTitle(details)}</h2>
            {reason && <p>{reason}</p>}
          </div>
        </header>
        <form
          className="approval-request-card__actions"
          onSubmit={(event) => {
            event.preventDefault();
            answer("turn");
          }}
        >
          <div className="approval-request-card__action-group">
            <button
              className="approval-request-button approval-request-button--deny"
              onClick={() => answer(null)}
              type="button"
            >
              Deny <kbd aria-hidden="true">Escape</kbd>
            </button>
            <div className="approval-request-split">
              <button
                autoFocus
                className="approval-request-button approval-request-button--approve"
                type="submit"
              >
                Allow once <kbd aria-hidden="true">⏎</kbd>
              </button>
              <button
                aria-expanded={optionsOpen}
                aria-haspopup="menu"
                aria-label="Approval options"
                className="approval-request-button approval-request-button--options"
                onClick={() => setOptionsOpen((open) => !open)}
                type="button"
              >
                <ApprovalChevronIcon />
              </button>
              {optionsOpen && (
                <div
                  aria-label="Approval options"
                  className="approval-request-options"
                  role="menu"
                >
                  <button
                    onClick={() => answer("turn")}
                    role="menuitem"
                    type="button"
                  >
                    Allow once
                  </button>
                  <button
                    onClick={() => answer("session")}
                    role="menuitem"
                    type="button"
                  >
                    <span>Allow this conversation</span>
                    <Info aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
